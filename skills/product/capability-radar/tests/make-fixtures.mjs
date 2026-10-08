import fs from 'node:fs';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
import {crc32} from '../scripts/archive-xml.mjs';

export function makeZip(entries, method = 0) {
  const localParts = [], directory = []; let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const raw = Buffer.from(value), filename = Buffer.from(name), compressed = method === 8 ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc32(raw), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc32(raw), 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    localParts.push(local, filename, compressed); directory.push(central, filename); offset += local.length + filename.length + compressed.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}
const root = path.resolve(process.argv[2]); fs.mkdirSync(root, {recursive: true});
const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
write('table.md', `# 能力盘点

| 编号 | 能力域 | 能力名称 | 三档分类 | 限制 |
|---|---|---|---|---|
| A | 数据 | 导入资料 | 已具备 | 仅样例 |
| B | 应用 | 生成应用 | 未来肯定能做到 | 内部使用 |
| C | 应用 | 执行任务 | 未来可能可以做到 | 未实测 |
| D | 应用 | 自动审批 | 在研 | 未明示可行性 |
| E | 数据 | 自研硬件 | 不具备 | 不自研 |

普通正文：这不是额外能力。

\`\`\`markdown
| 能力 | 状态 |
|---|---|
| 伪表 | 已具备 |
\`\`\`
`);
write('escaped.md', '| 编号 | 能力域 | 能力名称 | 三档分类 | 限制 |\n|---|---|---|---|---|\n| A | 数据 | 解析 `A|B` | 已具备 | A\\|B 格式 |\n');
write('narrative.txt', '资料导入：样例已跑通。自动审批只有计划，没有实测。');
write('gb18030.txt', Buffer.from([0xd6, 0xd0, 0xce, 0xc4]));
write('multiline.csv', 'id,group,name,status,limits\r\nA,数据,"导入\n资料",已具备,"引号 ""保留"""\r\n');
write('table.csv', 'id,group,name,status,limits\nA,数据,"导入,资料",已具备,仅样例\n');
write('table.tsv', 'id\tgroup\tname\tstatus\nA\t数据\t导入资料\t已具备\n');
write('semicolon.csv', 'id;group;name;status\nA;数据;导入资料;已具备\n');
write('utf16.csv', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('id,group,name,status\nA,数据,导入资料,已具备\n', 'utf16le')]));
write('utf16be.csv', Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('id,group,name,status\nA,数据,导入资料,已具备\n', 'utf16le').swap16()]));
write('json.json', JSON.stringify({name: '资料', values: [1, true]}));
write('bad.xls', 'not-an-xlsx');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const values = [['id', 'group', 'name', 'status', 'limits'], ['A', '数据', '导入资料', '已具备', '仅样例'], ['B', '应用', '执行任务', '可能做到', '未验证']];
const xmlEscape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sheetXml = shared => `<worksheet xmlns="${ns}"><sheetData>${values.map((row, i) => `<row r="${i + 1}">${row.map((value, j) => shared ? `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="s"><v>${i * 5 + j}</v></c>` : `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join('')}${i === 2 ? '<c r="F3"><f>1+1</f><v>2</v></c>' : ''}</row>`).join('')}</sheetData><mergeCells><mergeCell ref="G1:H1"/></mergeCells></worksheet>`;
const members = {
  'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="能力" sheetId="1" state="hidden" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml': sheetXml(false),
};
write('table.xlsx', makeZip(members, 8));
write('stored.xlsx', makeZip(members));
write('shared.xlsx', makeZip({...members, 'xl/worksheets/sheet1.xml': sheetXml(true), 'xl/sharedStrings.xml': `<sst xmlns="${ns}">${values.flat().map((v, i) => i === 7 ? `<si><r><t>导入</t></r><r><t>资料</t></r></si>` : `<si><t>${xmlEscape(v)}</t></si>`).join('')}</sst>`}, 8));
write('table.xlsm', makeZip({...members, 'xl/vbaProject.bin': 'unexecuted macro payload'}, 8));
write('dtd.xlsx', makeZip({...members, 'xl/workbook.xml': '<!DOCTYPE workbook [<!ENTITY ext SYSTEM "file:///etc/passwd">]>' + members['xl/workbook.xml']}, 8));
const encrypted = makeZip(members); encrypted.writeUInt16LE(0x801, 6); const centralOffset = encrypted.readUInt32LE(encrypted.length - 6); encrypted.writeUInt16LE(0x801, centralOffset + 8); write('encrypted.xlsx', encrypted);
const unsupported = makeZip(members); unsupported.writeUInt16LE(99, 8); const unsupportedOffset = unsupported.readUInt32LE(unsupported.length - 6); unsupported.writeUInt16LE(99, unsupportedOffset + 10); write('unsupported.xlsx', unsupported);
const oversized = makeZip(members); oversized.writeUInt32LE(97 * 1024 * 1024, oversized.readUInt32LE(oversized.length - 6) + 24); write('oversized.xlsx', oversized);
const corrupted = makeZip(members); corrupted[30 + Buffer.byteLength(Object.keys(members)[0])] ^= 1; write('corrupted.xlsx', corrupted);
write('table.docx', makeZip({'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>能力说明</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>能力名称</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>状态</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'}));
console.log('fixtures created');
