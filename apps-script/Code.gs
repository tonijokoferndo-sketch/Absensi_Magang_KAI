const KAI_FIELD_ALIASES = {
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

const KAI_DEFAULT_HEADERS = {
  users: ["NIM", "Nama", "Email", "Divisi", "Password", "Tanggal Daftar", "Role", "Password Hash", "Wajib Ganti Password", "Session Version"],
  attendance: ["NIM", "Nama", "Tanggal", "Jam Masuk", "Jam Pulang", "Status"]
};

const KAI_MASKED_PASSWORD = "****";

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || "{}");
    const result = kaiRoute(body);
    return kaiJsonResponse(result);
  } catch (error) {
    return kaiJsonResponse({
      status: false,
      message: error.publicMessage || "Terjadi kesalahan pada server."
    });
  }
}

function doGet() {
  return kaiJsonResponse({
    status: true,
    message: "Absensi Magang KAI API siap.",
    version: "accounts-password-date-v2"
  });
}

function tidyUsersSheet() {
  kaiReadTable("users");
}

function kaiJsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function kaiSetting(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw kaiApiError("Konfigurasi server belum lengkap: " + name + ".");
  }
  return value;
}

function kaiApiError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function kaiRoute(body) {
  switch (body.action) {
    case "login":
      return kaiLogin(body);
    case "register":
      return kaiRegister(body);
    case "list_users":
      return kaiListUsers(body);
    case "reset_password":
      return kaiResetUserPassword(body);
    case "change_password":
      return kaiChangeTemporaryPassword(body);
    case "qr_current":
      return kaiCurrentQr(body);
    case "absen_masuk":
    case "absen_pulang":
      return kaiUpdateAttendance(body, body.action);
    case "riwayat":
      return kaiGetHistory(body, false);
    case "riwayat_semua":
      return kaiGetHistory(body, true);
    default:
      throw kaiApiError("Aksi tidak dikenali.");
  }
}

function kaiSpreadsheet() {
  return SpreadsheetApp.openById(kaiSetting("SPREADSHEET_ID"));
}

function kaiSheetName(key) {
  const property = key === "users" ? "USERS_SHEET" : "ATTENDANCE_SHEET";
  return PropertiesService.getScriptProperties().getProperty(property) || key;
}

function kaiNormalizedHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function kaiFieldIndex(headers, field) {
  return headers.findIndex(function (header) {
    return KAI_FIELD_ALIASES[field].indexOf(kaiNormalizedHeader(header)) !== -1;
  });
}

function kaiReadTable(key) {
  const book = kaiSpreadsheet();
  const name = kaiSheetName(key);
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
  }

  let lastRow = sheet.getLastRow();
  let lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) {
    const headers = KAI_DEFAULT_HEADERS[key];
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
    if (kaiFieldIndex(headers, field) < 0) {
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
      headers.push(KAI_DEFAULT_HEADERS[key][defaultIndex]);
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
      values: kaiPadRow(headers, row)
    };
  });

  if (key === "users") {
    kaiMigrateAndFormatUsers(sheet, headers, rows);
  }

  return {
    sheet: sheet,
    headers: headers,
    rows: rows
  };
}

function kaiMigrateAndFormatUsers(sheet, headers, rows) {
  const passwordIndex = kaiFieldIndex(headers, "password");
  const hashIndex = kaiFieldIndex(headers, "passwordHash");
  const dateIndex = kaiFieldIndex(headers, "tanggalDaftar");

  rows.forEach(function (row) {
    const displayedPassword = String(row.values[passwordIndex] || "");
    const storedHash = String(row.values[hashIndex] || "");
    let changed = false;

    if (displayedPassword && !kaiIsMaskedPassword(displayedPassword)) {
      if (!storedHash) {
        row.values[hashIndex] = kaiIsPasswordHash(displayedPassword)
          ? displayedPassword
          : kaiPasswordHash(displayedPassword, Utilities.getUuid());
      }
      row.values[passwordIndex] = KAI_MASKED_PASSWORD;
      changed = true;
    } else if (
      displayedPassword !== KAI_MASKED_PASSWORD &&
      (storedHash || kaiIsMaskedPassword(displayedPassword))
    ) {
      row.values[passwordIndex] = KAI_MASKED_PASSWORD;
      changed = true;
    }

    if (changed) {
      kaiWriteRow({ sheet: sheet }, row.rowNumber, row.values);
    }
  });

  const passwordHashColumn = hashIndex + 1;
  sheet.hideColumns(passwordHashColumn);
  sheet.hideColumns(kaiFieldIndex(headers, "sessionVersion") + 1);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#0F4C81")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.setColumnWidth(passwordIndex + 1, 140);
  sheet.setColumnWidth(dateIndex + 1, 170);
}

function kaiPadRow(headers, values) {
  return Array.from({ length: headers.length }, function (_, index) {
    return values[index] || "";
  });
}

function kaiValueFor(headers, values, field) {
  const index = kaiFieldIndex(headers, field);
  return index < 0 ? "" : String(values[index] || "").trim();
}

function kaiRowFor(headers, fields) {
  const row = Array(headers.length).fill("");
  Object.keys(fields).forEach(function (field) {
    const index = kaiFieldIndex(headers, field);
    if (index >= 0) {
      row[index] = fields[field];
    }
  });
  return row;
}

function kaiFindRow(table, predicate) {
  return table.rows.find(predicate);
}

function kaiWriteRow(table, rowNumber, values) {
  table.sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
}

function kaiAppendRow(table, values) {
  table.sheet.appendRow(values);
}

function kaiDigestHex(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  ).map(function (byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
}

function kaiPasswordHash(password, salt) {
  return "sha256$" + salt + "$" + kaiDigestHex(salt + "|" + password);
}

function kaiIsPasswordHash(value) {
  return /^sha256\$[^$]+\$[0-9a-f]{64}$/i.test(String(value || ""));
}

function kaiIsMaskedPassword(value) {
  return ["****", "********", "••••••••"].indexOf(
    String(value || "")
  ) !== -1;
}

function kaiVerifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length === 3 && parts[0] === "sha256") {
    return kaiPasswordHash(password, parts[1]) === stored;
  }
  return String(password) === String(stored || "");
}

function kaiSignSession(user) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    nim: user.nim,
    nama: user.nama,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    sessionVersion: Number(user.sessionVersion || 0),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  })).replace(/=+$/, "");
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, kaiSetting("SESSION_SECRET"))
  ).replace(/=+$/, "");
  return payload + "." + signature;
}

function kaiVerifySession(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) {
    throw kaiApiError("Sesi tidak valid. Silakan login kembali.");
  }
  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], kaiSetting("SESSION_SECRET"))
  ).replace(/=+$/, "");
  if (parts[1] !== expected) {
    throw kaiApiError("Sesi tidak valid. Silakan login kembali.");
  }
  let session;
  try {
    session = JSON.parse(Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[0])
    ).getDataAsString());
  } catch (error) {
    throw kaiApiError("Sesi tidak valid. Silakan login kembali.");
  }
  if (!session.nim || session.exp <= Math.floor(Date.now() / 1000)) {
    throw kaiApiError("Sesi berakhir. Silakan login kembali.");
  }
  return session;
}

function kaiLogin(body) {
  const nim = String(body.nim || "").trim();
  const password = String(body.password || "");
  if (!nim || !password) {
    throw kaiApiError("NIM dan Password wajib diisi.");
  }

  const adminNim = kaiSetting("ADMIN_NIM");
  if (nim === adminNim) {
    if (password !== kaiSetting("ADMIN_PASSWORD")) {
      throw kaiApiError("NIM atau password salah.");
    }
    const admin = { nim: adminNim, nama: "Administrator", role: "admin" };
    return {
      status: true,
      message: "Login berhasil.",
      user: admin,
      sessionToken: kaiSignSession(admin)
    };
  }

  const table = kaiReadTable("users");
  const account = kaiFindRow(table, function (row) {
    return kaiValueFor(table.headers, row.values, "nim") === nim;
  });
  if (!account || !kaiVerifyPassword(
    password,
    kaiValueFor(table.headers, account.values, "passwordHash")
  )) {
    throw kaiApiError("NIM atau password salah.");
  }

  const user = {
    nim: nim,
    nama: kaiValueFor(table.headers, account.values, "nama"),
    email: kaiValueFor(table.headers, account.values, "email"),
    divisi: kaiValueFor(table.headers, account.values, "divisi"),
    role: kaiValueFor(table.headers, account.values, "role").toLowerCase() === "admin"
      ? "admin"
      : "user",
    mustChangePassword:
      kaiValueFor(table.headers, account.values, "mustChangePassword").toLowerCase() === "true",
    sessionVersion:
      Number(kaiValueFor(table.headers, account.values, "sessionVersion")) || 0
  };

  if (String(kaiValueFor(table.headers, account.values, "passwordHash")).indexOf("sha256$") !== 0) {
    const index = kaiFieldIndex(table.headers, "passwordHash");
    const displayIndex = kaiFieldIndex(table.headers, "password");
    account.values[index] = kaiPasswordHash(password, Utilities.getUuid());
    account.values[displayIndex] = KAI_MASKED_PASSWORD;
    kaiWriteRow(table, account.rowNumber, account.values);
  }

  return {
    status: true,
    message: "Login berhasil.",
    user: user,
    sessionToken: kaiSignSession(user),
    mustChangePassword: user.mustChangePassword
  };
}

function kaiRegister(body) {
  const nim = String(body.nim || "").trim();
  const nama = String(body.nama || "").trim();
  const password = String(body.password || "");
  if (!nim || !nama || !password) {
    throw kaiApiError("NIM, nama, dan password wajib diisi.");
  }
  if (nim === kaiSetting("ADMIN_NIM")) {
    throw kaiApiError("NIM sudah terdaftar");
  }

  const table = kaiReadTable("users");
  if (kaiFindRow(table, function (row) {
    return kaiValueFor(table.headers, row.values, "nim") === nim;
  })) {
    throw kaiApiError("NIM sudah terdaftar");
  }

  kaiAppendRow(table, kaiRowFor(table.headers, {
    nim: nim,
    nama: nama,
    email: String(body.email || "").trim(),
    divisi: String(body.divisi || "").trim(),
    password: KAI_MASKED_PASSWORD,
    passwordHash: kaiPasswordHash(password, Utilities.getUuid()),
    tanggalDaftar: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"),
    mustChangePassword: false,
    sessionVersion: 0,
    role: "user"
  }));
  return { status: true, message: "Pendaftaran berhasil." };
}

function kaiRequireAdmin(body) {
  const session = kaiVerifySession(body.sessionToken);
  if (session.role !== "admin") {
    throw kaiApiError("Akses admin diperlukan.");
  }
  return session;
}

function kaiListUsers(body) {
  kaiRequireAdmin(body);
  const table = kaiReadTable("users");
  const users = table.rows.map(function (row) {
    return {
      nim: kaiValueFor(table.headers, row.values, "nim"),
      nama: kaiValueFor(table.headers, row.values, "nama"),
      email: kaiValueFor(table.headers, row.values, "email"),
      divisi: kaiValueFor(table.headers, row.values, "divisi"),
      tanggalDaftar: kaiValueFor(table.headers, row.values, "tanggalDaftar"),
      password: KAI_MASKED_PASSWORD,
      role: kaiValueFor(table.headers, row.values, "role") || "user"
    };
  }).filter(function (user) {
    return user.nim &&
      user.nim !== kaiSetting("ADMIN_NIM") &&
      user.role.toLowerCase() !== "admin";
  });
  return { status: true, users: users };
}

function kaiAssertCurrentUserSession(session) {
  const table = kaiReadTable("users");
  const account = kaiFindRow(table, function (row) {
    return kaiValueFor(table.headers, row.values, "nim") === session.nim;
  });
  if (
    !account ||
    (Number(kaiValueFor(table.headers, account.values, "sessionVersion")) || 0) !==
      Number(session.sessionVersion || 0)
  ) {
    throw kaiApiError("Sandi akun telah diubah. Silakan login kembali.");
  }
  return account;
}

function kaiResetUserPassword(body) {
  kaiRequireAdmin(body);
  const nim = String(body.nim || "").trim();
  if (!nim || nim === kaiSetting("ADMIN_NIM")) {
    throw kaiApiError("Akun yang dipilih tidak valid.");
  }

  const table = kaiReadTable("users");
  const account = kaiFindRow(table, function (row) {
    return kaiValueFor(table.headers, row.values, "nim") === nim;
  });
  if (!account) {
    throw kaiApiError("Akun user tidak ditemukan.");
  }
  if (kaiValueFor(table.headers, account.values, "role").toLowerCase() === "admin") {
    throw kaiApiError("Reset sandi hanya tersedia untuk akun user.");
  }

  const temporaryPassword = (
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "")
  ).slice(0, 20).toUpperCase();
  account.values[kaiFieldIndex(table.headers, "password")] = KAI_MASKED_PASSWORD;
  account.values[kaiFieldIndex(table.headers, "passwordHash")] =
    kaiPasswordHash(temporaryPassword, Utilities.getUuid());
  account.values[kaiFieldIndex(table.headers, "mustChangePassword")] = true;
  const versionIndex = kaiFieldIndex(table.headers, "sessionVersion");
  account.values[versionIndex] =
    (Number(account.values[versionIndex]) || 0) + 1;
  kaiWriteRow(table, account.rowNumber, account.values);

  return {
    status: true,
    message: "Sandi sementara dibuat. Salin dan sampaikan secara pribadi kepada user.",
    temporaryPassword: temporaryPassword
  };
}

function kaiChangeTemporaryPassword(body) {
  const session = kaiVerifySession(body.sessionToken);
  if (!session.mustChangePassword || session.role !== "user") {
    throw kaiApiError("Akun ini tidak sedang diwajibkan mengganti sandi.");
  }
  kaiAssertCurrentUserSession(session);

  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) {
    throw kaiApiError("Sandi baru minimal 8 karakter.");
  }

  const table = kaiReadTable("users");
  const account = kaiFindRow(table, function (row) {
    return kaiValueFor(table.headers, row.values, "nim") === session.nim;
  });
  if (!account) {
    throw kaiApiError("Akun user tidak ditemukan.");
  }

  account.values[kaiFieldIndex(table.headers, "password")] = KAI_MASKED_PASSWORD;
  account.values[kaiFieldIndex(table.headers, "passwordHash")] =
    kaiPasswordHash(newPassword, Utilities.getUuid());
  account.values[kaiFieldIndex(table.headers, "mustChangePassword")] = false;
  const versionIndex = kaiFieldIndex(table.headers, "sessionVersion");
  account.values[versionIndex] =
    (Number(account.values[versionIndex]) || 0) + 1;
  kaiWriteRow(table, account.rowNumber, account.values);

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
    sessionToken: kaiSignSession(user)
  };
}

function kaiCurrentQr(body) {
  kaiRequireAdmin(body);
  const offset = 7 * 60 * 60 * 1000;
  const slotMs = 12 * 60 * 60 * 1000;
  const slot = Math.floor((Date.now() + offset) / slotMs);
  const token = kaiDigestHex(kaiSetting("QR_SECRET") + ":" + slot).slice(0, 16);
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

function kaiIsValidQr(value) {
  const match = /^KAI-ABSEN\|(\d+)\|([0-9a-f]{16})$/.exec(
    String(value || "").trim()
  );
  if (!match) {
    return false;
  }
  const slotMs = 12 * 60 * 60 * 1000;
  const slot = Math.floor((Date.now() + 7 * 60 * 60 * 1000) / slotMs);
  const expected = kaiDigestHex(kaiSetting("QR_SECRET") + ":" + slot).slice(0, 16);
  return Number(match[1]) === slot && match[2] === expected;
}

function kaiWibDate() {
  return Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
}

function kaiWibTime() {
  return Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");
}

function kaiUpdateAttendance(body, action) {
  const session = kaiVerifySession(body.sessionToken);
  if (session.role !== "user") {
    throw kaiApiError("Hanya akun user yang dapat melakukan absensi.");
  }
  if (session.mustChangePassword) {
    throw kaiApiError("Ganti sandi sementara sebelum menggunakan absensi.");
  }
  kaiAssertCurrentUserSession(session);
  if (!kaiIsValidQr(body.qr)) {
    throw kaiApiError("QR Code tidak valid atau sudah kedaluwarsa.");
  }

  const table = kaiReadTable("attendance");
  const today = kaiWibDate();
  const attendance = kaiFindRow(table, function (row) {
    return kaiValueFor(table.headers, row.values, "nim") === session.nim &&
      kaiValueFor(table.headers, row.values, "tanggal").slice(0, 10) === today;
  });

  if (action === "absen_masuk") {
    if (attendance && kaiValueFor(table.headers, attendance.values, "jamMasuk")) {
      throw kaiApiError("Anda sudah absen masuk hari ini.");
    }
    const values = attendance
      ? attendance.values
      : kaiRowFor(table.headers, { nim: session.nim, nama: session.nama });
    const updates = kaiRowFor(table.headers, {
      nim: session.nim,
      nama: session.nama,
      tanggal: today,
      jamMasuk: kaiWibTime(),
      status: "Hadir"
    });
    updates.forEach(function (value, index) {
      if (value !== "") values[index] = value;
    });
    if (attendance) {
      kaiWriteRow(table, attendance.rowNumber, values);
    } else {
      kaiAppendRow(table, values);
    }
    return { status: true, message: "Absen masuk berhasil." };
  }

  if (!attendance || !kaiValueFor(table.headers, attendance.values, "jamMasuk")) {
    throw kaiApiError("Data absen masuk hari ini tidak ditemukan.");
  }
  if (kaiValueFor(table.headers, attendance.values, "jamPulang")) {
    throw kaiApiError("Anda sudah absen pulang hari ini.");
  }
  const values = attendance.values;
  const updates = kaiRowFor(table.headers, {
    nim: session.nim,
    nama: session.nama,
    tanggal: today,
    jamPulang: kaiWibTime(),
    status: "Hadir"
  });
  updates.forEach(function (value, index) {
    if (value !== "") values[index] = value;
  });
  kaiWriteRow(table, attendance.rowNumber, values);
  return { status: true, message: "Absen pulang berhasil." };
}

function kaiGetHistory(body, allUsers) {
  const session = kaiVerifySession(body.sessionToken);
  if (session.mustChangePassword) {
    throw kaiApiError("Ganti sandi sementara sebelum membuka riwayat.");
  }
  if (session.role === "user") {
    kaiAssertCurrentUserSession(session);
  }
  if (allUsers && session.role !== "admin") {
    throw kaiApiError("Akses admin diperlukan.");
  }

  const table = kaiReadTable("attendance");
  const history = table.rows.map(function (row) {
    return {
      nim: kaiValueFor(table.headers, row.values, "nim"),
      nama: kaiValueFor(table.headers, row.values, "nama"),
      tanggal: kaiValueFor(table.headers, row.values, "tanggal"),
      jamMasuk: kaiValueFor(table.headers, row.values, "jamMasuk"),
      jamPulang: kaiValueFor(table.headers, row.values, "jamPulang"),
      status: kaiValueFor(table.headers, row.values, "status")
    };
  }).filter(function (record) {
    return record.nim && (allUsers || record.nim === session.nim);
  }).sort(function (left, right) {
    return (right.tanggal + " " + right.jamMasuk)
      .localeCompare(left.tanggal + " " + left.jamMasuk);
  });

  return { status: true, riwayat: history };
}
