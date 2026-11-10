const FIELD_ALIASES = {
  nim: ["nim", "nomorindukmahasiswa", "nomorinduk", "studentid", "username"],
  nama: ["nama", "namalengkap", "name", "fullname"],
  email: ["email", "alamatemail"],
  divisi: ["divisi", "unit", "departemen", "department"],
  password: ["password", "katasandi", "sandi"],
  passwordHash: ["passwordhash", "hashpassword", "hashsandi"],
  mustChangePassword: ["wajibgantipassword", "wajibgantipass", "mustchangepassword", "resetpassword"],
  sessionVersion: ["sessionversion", "versisession", "versikredensial"],
  role: ["role", "peran", "jenisakun", "tipeakun"],
  tanggalDaftar: ["tanggaldaftar", "tanggalregistrasi", "tanggalregistrasiakun", "registrationdate", "registeredat", "createdat"],
  tanggal: ["tanggal", "date", "tanggalabsen", "timestamp", "waktu"],
  jamMasuk: ["jammasuk", "masuk", "checkin", "checkintime", "waktumasuk"],
  jamPulang: ["jampulang", "jamkeluar", "pulang", "keluar", "checkout", "checkouttime", "waktupulang", "waktukeluar"],
  status: ["status", "keterangan"]
};

const DEFAULT_HEADERS = {
  users: ["NIM", "Nama", "Email", "Divisi", "Password", "Tanggal Daftar", "Role", "Password Hash", "Wajib Ganti Password", "Session Version"],
  attendance: ["NIM", "Nama", "Tanggal", "Jam Masuk", "Jam Pulang", "Status"]
};

const MASKED_PASSWORD = "••••••••";

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || "{}");
    const result = route(body);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      status: false,
      message: error.publicMessage || "Terjadi kesalahan pada server."
    });
  }
}

function doGet() {
  return jsonResponse({
    status: true,
    message: "Absensi Magang KAI API siap."
  });
}

function tidyUsersSheet() {
  readTable("users");
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function setting(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw apiError("Konfigurasi server belum lengkap: " + name + ".");
  }
  return value;
}

function apiError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function route(body) {
  switch (body.action) {
    case "login":
      return login(body);
    case "register":
      return register(body);
    case "list_users":
      return listUsers(body);
    case "reset_password":
      return resetUserPassword(body);
    case "change_password":
      return changeTemporaryPassword(body);
    case "qr_current":
      return currentQr(body);
    case "absen_masuk":
    case "absen_pulang":
      return updateAttendance(body, body.action);
    case "riwayat":
      return getHistory(body, false);
    case "riwayat_semua":
      return getHistory(body, true);
    default:
      throw apiError("Aksi tidak dikenali.");
  }
}

function spreadsheet() {
  return SpreadsheetApp.openById(setting("SPREADSHEET_ID"));
}

function sheetName(key) {
  const property = key === "users" ? "USERS_SHEET" : "ATTENDANCE_SHEET";
  return PropertiesService.getScriptProperties().getProperty(property) || key;
}

function normalizedHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function fieldIndex(headers, field) {
  return headers.findIndex(function (header) {
    return FIELD_ALIASES[field].indexOf(normalizedHeader(header)) !== -1;
  });
}

function readTable(key) {
  const book = spreadsheet();
  const name = sheetName(key);
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
  }

  let lastRow = sheet.getLastRow();
  let lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) {
    const headers = DEFAULT_HEADERS[key];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    lastRow = 1;
    lastColumn = headers.length;
  }

  let headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const required = key === "users"
    ? ["nim", "nama", "password", "passwordHash", "tanggalDaftar", "role", "mustChangePassword", "sessionVersion"]
    : ["nim", "nama", "tanggal", "jamMasuk", "jamPulang", "status"];
  let changed = false;

  required.forEach(function (field) {
    if (fieldIndex(headers, field) < 0) {
      const defaultIndex = key === "users"
        ? {
          nim: 0,
          nama: 1,
          password: 4,
          tanggalDaftar: 5,
          role: 6,
          passwordHash: 7,
          mustChangePassword: 8,
          sessionVersion: 9
        }[field]
        : ["nim", "nama", "tanggal", "jamMasuk", "jamPulang", "status"].indexOf(field);
      headers.push(DEFAULT_HEADERS[key][defaultIndex]);
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    lastColumn = headers.length;
  }

  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues()
    : [];
  const rows = values.map(function (row, index) {
    return {
      rowNumber: index + 2,
      values: padRow(headers, row)
    };
  });

  if (key === "users") {
    migrateAndFormatUsers(sheet, headers, rows);
  }

  return {
    sheet: sheet,
    headers: headers,
    rows: rows
  };
}

function migrateAndFormatUsers(sheet, headers, rows) {
  const passwordIndex = fieldIndex(headers, "password");
  const hashIndex = fieldIndex(headers, "passwordHash");
  const dateIndex = fieldIndex(headers, "tanggalDaftar");

  rows.forEach(function (row) {
    const displayedPassword = String(row.values[passwordIndex] || "");
    const storedHash = String(row.values[hashIndex] || "");
    let changed = false;

    if (displayedPassword && displayedPassword !== MASKED_PASSWORD) {
      if (!storedHash) {
        row.values[hashIndex] = isPasswordHash(displayedPassword)
          ? displayedPassword
          : passwordHash(displayedPassword, Utilities.getUuid());
      }
      row.values[passwordIndex] = MASKED_PASSWORD;
      changed = true;
    } else if (storedHash && !displayedPassword) {
      row.values[passwordIndex] = MASKED_PASSWORD;
      changed = true;
    }

    if (changed) {
      writeRow({ sheet: sheet }, row.rowNumber, row.values);
    }
  });

  const passwordHashColumn = hashIndex + 1;
  sheet.hideColumns(passwordHashColumn);
  sheet.hideColumns(fieldIndex(headers, "sessionVersion") + 1);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#0F4C81")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.setColumnWidth(passwordIndex + 1, 140);
  sheet.setColumnWidth(dateIndex + 1, 170);
}

function padRow(headers, values) {
  return Array.from({ length: headers.length }, function (_, index) {
    return values[index] || "";
  });
}

function valueFor(headers, values, field) {
  const index = fieldIndex(headers, field);
  return index < 0 ? "" : String(values[index] || "").trim();
}

function rowFor(headers, fields) {
  const row = Array(headers.length).fill("");
  Object.keys(fields).forEach(function (field) {
    const index = fieldIndex(headers, field);
    if (index >= 0) {
      row[index] = fields[field];
    }
  });
  return row;
}

function findRow(table, predicate) {
  return table.rows.find(predicate);
}

function writeRow(table, rowNumber, values) {
  table.sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
}

function appendRow(table, values) {
  table.sheet.appendRow(values);
}

function digestHex(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  ).map(function (byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
}

function passwordHash(password, salt) {
  return "sha256$" + salt + "$" + digestHex(salt + "|" + password);
}

function isPasswordHash(value) {
  return /^sha256\$[^$]+\$[0-9a-f]{64}$/i.test(String(value || ""));
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length === 3 && parts[0] === "sha256") {
    return passwordHash(password, parts[1]) === stored;
  }
  return String(password) === String(stored || "");
}

function signSession(user) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    nim: user.nim,
    nama: user.nama,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    sessionVersion: Number(user.sessionVersion || 0),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  })).replace(/=+$/, "");
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, setting("SESSION_SECRET"))
  ).replace(/=+$/, "");
  return payload + "." + signature;
}

function verifySession(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) {
    throw apiError("Sesi tidak valid. Silakan login kembali.");
  }
  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], setting("SESSION_SECRET"))
  ).replace(/=+$/, "");
  if (parts[1] !== expected) {
    throw apiError("Sesi tidak valid. Silakan login kembali.");
  }
  let session;
  try {
    session = JSON.parse(Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[0])
    ).getDataAsString());
  } catch (error) {
    throw apiError("Sesi tidak valid. Silakan login kembali.");
  }
  if (!session.nim || session.exp <= Math.floor(Date.now() / 1000)) {
    throw apiError("Sesi berakhir. Silakan login kembali.");
  }
  return session;
}

function login(body) {
  const nim = String(body.nim || "").trim();
  const password = String(body.password || "");
  if (!nim || !password) {
    throw apiError("NIM dan Password wajib diisi.");
  }

  const adminNim = setting("ADMIN_NIM");
  if (nim === adminNim) {
    if (password !== setting("ADMIN_PASSWORD")) {
      throw apiError("NIM atau password salah.");
    }
    const admin = { nim: adminNim, nama: "Administrator", role: "admin" };
    return {
      status: true,
      message: "Login berhasil.",
      user: admin,
      sessionToken: signSession(admin)
    };
  }

  const table = readTable("users");
  const account = findRow(table, function (row) {
    return valueFor(table.headers, row.values, "nim") === nim;
  });
  if (!account || !verifyPassword(
    password,
    valueFor(table.headers, account.values, "passwordHash")
  )) {
    throw apiError("NIM atau password salah.");
  }

  const user = {
    nim: nim,
    nama: valueFor(table.headers, account.values, "nama"),
    email: valueFor(table.headers, account.values, "email"),
    divisi: valueFor(table.headers, account.values, "divisi"),
    role: valueFor(table.headers, account.values, "role").toLowerCase() === "admin"
      ? "admin"
      : "user",
    mustChangePassword:
      valueFor(table.headers, account.values, "mustChangePassword").toLowerCase() === "true",
    sessionVersion:
      Number(valueFor(table.headers, account.values, "sessionVersion")) || 0
  };

  if (String(valueFor(table.headers, account.values, "passwordHash")).indexOf("sha256$") !== 0) {
    const index = fieldIndex(table.headers, "passwordHash");
    const displayIndex = fieldIndex(table.headers, "password");
    account.values[index] = passwordHash(password, Utilities.getUuid());
    account.values[displayIndex] = MASKED_PASSWORD;
    writeRow(table, account.rowNumber, account.values);
  }

  return {
    status: true,
    message: "Login berhasil.",
    user: user,
    sessionToken: signSession(user),
    mustChangePassword: user.mustChangePassword
  };
}

function register(body) {
  const nim = String(body.nim || "").trim();
  const nama = String(body.nama || "").trim();
  const password = String(body.password || "");
  if (!nim || !nama || !password) {
    throw apiError("NIM, nama, dan password wajib diisi.");
  }
  if (nim === setting("ADMIN_NIM")) {
    throw apiError("NIM sudah terdaftar");
  }

  const table = readTable("users");
  if (findRow(table, function (row) {
    return valueFor(table.headers, row.values, "nim") === nim;
  })) {
    throw apiError("NIM sudah terdaftar");
  }

  appendRow(table, rowFor(table.headers, {
    nim: nim,
    nama: nama,
    email: String(body.email || "").trim(),
    divisi: String(body.divisi || "").trim(),
    password: MASKED_PASSWORD,
    passwordHash: passwordHash(password, Utilities.getUuid()),
    tanggalDaftar: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"),
    mustChangePassword: false,
    sessionVersion: 0,
    role: "user"
  }));
  return { status: true, message: "Pendaftaran berhasil." };
}

function requireAdmin(body) {
  const session = verifySession(body.sessionToken);
  if (session.role !== "admin") {
    throw apiError("Akses admin diperlukan.");
  }
  return session;
}

function listUsers(body) {
  requireAdmin(body);
  const table = readTable("users");
  const users = table.rows.map(function (row) {
    return {
      nim: valueFor(table.headers, row.values, "nim"),
      nama: valueFor(table.headers, row.values, "nama"),
      email: valueFor(table.headers, row.values, "email"),
      divisi: valueFor(table.headers, row.values, "divisi"),
      tanggalDaftar: valueFor(table.headers, row.values, "tanggalDaftar"),
      role: valueFor(table.headers, row.values, "role") || "user"
    };
  }).filter(function (user) {
    return user.nim &&
      user.nim !== setting("ADMIN_NIM") &&
      user.role.toLowerCase() !== "admin";
  });
  return { status: true, users: users };
}

function assertCurrentUserSession(session) {
  const table = readTable("users");
  const account = findRow(table, function (row) {
    return valueFor(table.headers, row.values, "nim") === session.nim;
  });
  if (
    !account ||
    (Number(valueFor(table.headers, account.values, "sessionVersion")) || 0) !==
      Number(session.sessionVersion || 0)
  ) {
    throw apiError("Sandi akun telah diubah. Silakan login kembali.");
  }
  return account;
}

function resetUserPassword(body) {
  requireAdmin(body);
  const nim = String(body.nim || "").trim();
  if (!nim || nim === setting("ADMIN_NIM")) {
    throw apiError("Akun yang dipilih tidak valid.");
  }

  const table = readTable("users");
  const account = findRow(table, function (row) {
    return valueFor(table.headers, row.values, "nim") === nim;
  });
  if (!account) {
    throw apiError("Akun user tidak ditemukan.");
  }
  if (valueFor(table.headers, account.values, "role").toLowerCase() === "admin") {
    throw apiError("Reset sandi hanya tersedia untuk akun user.");
  }

  const temporaryPassword = (
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "")
  ).slice(0, 20).toUpperCase();
  account.values[fieldIndex(table.headers, "password")] = MASKED_PASSWORD;
  account.values[fieldIndex(table.headers, "passwordHash")] =
    passwordHash(temporaryPassword, Utilities.getUuid());
  account.values[fieldIndex(table.headers, "mustChangePassword")] = true;
  const versionIndex = fieldIndex(table.headers, "sessionVersion");
  account.values[versionIndex] =
    (Number(account.values[versionIndex]) || 0) + 1;
  writeRow(table, account.rowNumber, account.values);

  return {
    status: true,
    message: "Sandi sementara dibuat. Salin dan sampaikan secara pribadi kepada user.",
    temporaryPassword: temporaryPassword
  };
}

function changeTemporaryPassword(body) {
  const session = verifySession(body.sessionToken);
  if (!session.mustChangePassword || session.role !== "user") {
    throw apiError("Akun ini tidak sedang diwajibkan mengganti sandi.");
  }
  assertCurrentUserSession(session);

  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) {
    throw apiError("Sandi baru minimal 8 karakter.");
  }

  const table = readTable("users");
  const account = findRow(table, function (row) {
    return valueFor(table.headers, row.values, "nim") === session.nim;
  });
  if (!account) {
    throw apiError("Akun user tidak ditemukan.");
  }

  account.values[fieldIndex(table.headers, "password")] = MASKED_PASSWORD;
  account.values[fieldIndex(table.headers, "passwordHash")] =
    passwordHash(newPassword, Utilities.getUuid());
  account.values[fieldIndex(table.headers, "mustChangePassword")] = false;
  const versionIndex = fieldIndex(table.headers, "sessionVersion");
  account.values[versionIndex] =
    (Number(account.values[versionIndex]) || 0) + 1;
  writeRow(table, account.rowNumber, account.values);

  const user = {
    nim: session.nim,
    nama: session.nama,
    role: "user",
    mustChangePassword: false,
    sessionVersion: Number(account.values[versionIndex])
  };
  return {
    status: true,
    message: "Sandi berhasil diganti.",
    user: user,
    sessionToken: signSession(user)
  };
}

function currentQr(body) {
  requireAdmin(body);
  const offset = 7 * 60 * 60 * 1000;
  const slotMs = 12 * 60 * 60 * 1000;
  const slot = Math.floor((Date.now() + offset) / slotMs);
  const token = digestHex(setting("QR_SECRET") + ":" + slot).slice(0, 16);
  return {
    status: true,
    qr: {
      slot: slot,
      token: token,
      payload: "KAI-ABSEN|" + slot + "|" + token,
      expiresAt: (slot + 1) * slotMs - offset
    }
  };
}

function isValidQr(value) {
  const match = /^KAI-ABSEN\|(\d+)\|([0-9a-f]{16})$/.exec(
    String(value || "").trim()
  );
  if (!match) {
    return false;
  }
  const slotMs = 12 * 60 * 60 * 1000;
  const slot = Math.floor((Date.now() + 7 * 60 * 60 * 1000) / slotMs);
  const expected = digestHex(setting("QR_SECRET") + ":" + slot).slice(0, 16);
  return Number(match[1]) === slot && match[2] === expected;
}

function wibDate() {
  return Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
}

function wibTime() {
  return Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");
}

function updateAttendance(body, action) {
  const session = verifySession(body.sessionToken);
  if (session.role !== "user") {
    throw apiError("Hanya akun user yang dapat melakukan absensi.");
  }
  if (session.mustChangePassword) {
    throw apiError("Ganti sandi sementara sebelum menggunakan absensi.");
  }
  assertCurrentUserSession(session);
  if (!isValidQr(body.qr)) {
    throw apiError("QR Code tidak valid atau sudah kedaluwarsa.");
  }

  const table = readTable("attendance");
  const today = wibDate();
  const attendance = findRow(table, function (row) {
    return valueFor(table.headers, row.values, "nim") === session.nim &&
      valueFor(table.headers, row.values, "tanggal").slice(0, 10) === today;
  });

  if (action === "absen_masuk") {
    if (attendance && valueFor(table.headers, attendance.values, "jamMasuk")) {
      throw apiError("Anda sudah absen masuk hari ini.");
    }
    const values = attendance
      ? attendance.values
      : rowFor(table.headers, { nim: session.nim, nama: session.nama });
    const updates = rowFor(table.headers, {
      nim: session.nim,
      nama: session.nama,
      tanggal: today,
      jamMasuk: wibTime(),
      status: "Hadir"
    });
    updates.forEach(function (value, index) {
      if (value !== "") values[index] = value;
    });
    if (attendance) {
      writeRow(table, attendance.rowNumber, values);
    } else {
      appendRow(table, values);
    }
    return { status: true, message: "Absen masuk berhasil." };
  }

  if (!attendance || !valueFor(table.headers, attendance.values, "jamMasuk")) {
    throw apiError("Data absen masuk hari ini tidak ditemukan.");
  }
  if (valueFor(table.headers, attendance.values, "jamPulang")) {
    throw apiError("Anda sudah absen pulang hari ini.");
  }
  const values = attendance.values;
  const updates = rowFor(table.headers, {
    nim: session.nim,
    nama: session.nama,
    tanggal: today,
    jamPulang: wibTime(),
    status: "Hadir"
  });
  updates.forEach(function (value, index) {
    if (value !== "") values[index] = value;
  });
  writeRow(table, attendance.rowNumber, values);
  return { status: true, message: "Absen pulang berhasil." };
}

function getHistory(body, allUsers) {
  const session = verifySession(body.sessionToken);
  if (session.mustChangePassword) {
    throw apiError("Ganti sandi sementara sebelum membuka riwayat.");
  }
  if (session.role === "user") {
    assertCurrentUserSession(session);
  }
  if (allUsers && session.role !== "admin") {
    throw apiError("Akses admin diperlukan.");
  }

  const table = readTable("attendance");
  const history = table.rows.map(function (row) {
    return {
      nim: valueFor(table.headers, row.values, "nim"),
      nama: valueFor(table.headers, row.values, "nama"),
      tanggal: valueFor(table.headers, row.values, "tanggal"),
      jamMasuk: valueFor(table.headers, row.values, "jamMasuk"),
      jamPulang: valueFor(table.headers, row.values, "jamPulang"),
      status: valueFor(table.headers, row.values, "status")
    };
  }).filter(function (record) {
    return record.nim && (allUsers || record.nim === session.nim);
  }).sort(function (left, right) {
    return (right.tanggal + " " + right.jamMasuk)
      .localeCompare(left.tanggal + " " + left.jamMasuk);
  });

  return { status: true, riwayat: history };
}
