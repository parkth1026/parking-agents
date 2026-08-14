// zip.mjs — 最小 ZIP writer（STORE 不压缩，标准 zip 格式）
// 产出可被 python -m zipfile -l / unzip / 各平台解压器直接读取。
// 条目路径一律使用 / 分隔（zip 规范），写入时置 UTF-8 文件名位。

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** JS Date → DOS 日期时间字段（本地时区，秒精度 /2） */
function dosDateTime(mtime) {
  const time = ((mtime.getHours() & 0x1f) << 11)
    | ((mtime.getMinutes() & 0x3f) << 5)
    | ((Math.floor(mtime.getSeconds() / 2)) & 0x1f);
  const date = (((mtime.getFullYear() - 1980) & 0x7f) << 9)
    | (((mtime.getMonth() + 1) & 0x0f) << 5)
    | (mtime.getDate() & 0x1f);
  return { time, date };
}

/**
 * 生成 STORE 模式 zip Buffer。
 * entries: [{ name: "dir/file.ext", data: Buffer }]
 */
export function buildStoreZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const { time, date } = dosDateTime(entry.mtime instanceof Date ? entry.mtime : new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4);         // version needed
    local.writeUInt16LE(0x0800, 6);     // flags: bit 11 UTF-8 filename
    local.writeUInt16LE(0, 8);          // method: STORE
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18); // compressed size
    local.writeUInt32LE(entry.data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);          // extra length
    localParts.push(local, nameBytes, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);     // flags
    central.writeUInt16LE(0, 10);         // method: STORE
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);         // extra
    central.writeUInt16LE(0, 32);         // comment
    central.writeUInt16LE(0, 34);         // disk start
    central.writeUInt16LE(0, 36);         // internal attrs
    central.writeUInt32LE(0, 38);         // external attrs
    central.writeUInt32LE(offset, 42);    // local header offset
    centralParts.push(central, nameBytes);

    offset += 30 + nameBytes.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}
