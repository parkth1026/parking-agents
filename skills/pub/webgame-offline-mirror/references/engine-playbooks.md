# 引擎指纹与资产模式手册

第 0 层侦察先对号入座。指纹从 entry HTML 和首批 JS 的特征判断。

## Vite / Rollup 系 SPA 游戏（three.js / React / Vue 重前端）

指纹：HTML 引 `assets/<name>-<hash>.js`、`link rel=modulepreload`、`_vite/`、`import.meta.url`。
资产模式：全部字面量引用带 content hash；游戏数据在 `data/*.json`（无哈希、public 目录）；资源由 `base+'assets/'+path+'?v='+build` 拼接；多语言 = 独立懒加载 chunk。
策略：三层全上；hash 锚定正则天然适配。sourcemap 常被禁用（生产默认关）。

## Unity WebGL

指纹：`<name>.loader.js`、Unity 的进度条模板、`UnityLoader`/`createUnityInstance`。
资产模式：`<name>.data`（序列化资产+场景）、`<name>.wasm`、`<name>.framework.js`、`StreamingAssets/` 下的 Addressables/AssetBundle（`.bundle`，常带哈希目录）、CDN 分片。
策略：loader/data/wasm 闭包可抓；bundle 清单由运行时请求——**运行时录制为主**。存档在 IndexedDB（本地天然离线）。检查 `StreamingAssets/catalog.json` 一类清单文件，有它就是现成的全集列表。

## Godot 4 Web

指纹：`index.js` + `index.pck` + `index.wasm`、Godot 启动画面。
资产模式：几乎所有资源打进单个 `.pck`。
策略：抓 HTML 引用的全套文件即完成 90%+；pck 不用解。配置/存档走 JS bridge（localStorage/IndexedDB）。

## Phaser / PixiJS 2D

指纹：`phaser.min.js` / `pixi.min.js`、`new Phaser.Game`、`LoaderPlugin`。
资产模式：图集 atlas JSON（TexturePacker/Phaser Atlas 格式）+ png 成对；音效 mp3/ogg；位图字体 `.xml`/`.fnt`。
策略：闭包抓 entry 后**解析每个 atlas JSON 的 `image`/`meta.image` 字段**（相对路径、无引号键，引用提取器对 JSON 天然友好）；音频文件名常在 preload 场景的字面量数组里。

## Construct 3

指纹：`c3runtime.js`、`data.js`、`scripts/offlineclient.js`。
资产模式：`data.js` 巨型单文件含全部逻辑；媒体在 `media/` 目录；官方导出常自带 offline client（PWA）——**它的 SW precache 清单就是完整文件列表**。
策略：先找 SW/manifest 清单，直接按清单抓。

## PlayCanvas

指纹：`__start__.js`、`config.json`、`pc.app`。
资产模式：`files/assets/<id>/<hash>.json|png|ogg`，由 `config.json` 场景图引用。
策略：抓 `config.json`，解析场景层级引用的 asset id 生成 URL 列表（家族枚举的好对象）。

## 通用建议

- 引擎判断拿不准时，跑一轮 mirror 闭包 + 一轮运行时录制，看请求形状再定。
- 多引擎混用（Vite 壳 + Unity iframe 嵌入）按主入口引擎处理，iframe src 当独立目标追加。
- WASM 大文件（>50MB）注意磁盘与 git：镜像入库用 `gitattributes` 标 binary 且锁换行转换。
