# MiaoBaGua

<img src="public/assets/miaobagua-logo.png" alt="MiaoBaGua 三花猫举筒正式 Logo" width="160" />

正式 Logo：三花猫举筒。

Windows 直播组件应用：三花小猫抱盅摇卦，三枚骰子同步运动，停稳后显示上下排列的自然图案。主播在私人控制台操作、查看结果和历史；两个独立直播窗口只显示图案与动画。

当前版本：**1.2.13**。

## 使用

双击 `MiaoBaGua-1.2.13-Windows.exe`，无需安装 Node.js。开发构建的便携程序输出到 `release/`。

在直播伴侣中分别添加“窗口捕获”：

- **灵感骰子 · 直播组件**：自然图案骰子和结果卡。
- **三花守摊猫 · 直播组件**：独立小猫动画，可单独摆放和缩放。

控制台点击“摇卦”或按 **Ctrl + Shift + G**，两个窗口以同一时钟播放约 6.4 秒的完整过程。详细操作见 [使用说明](使用说明.md)。

## 当前功能

- 三花猫使用独立头部、躯干、竹盅与双臂素材。双臂以肩、肘、腕关节屈伸；脚底稳定落地，眼神、耳朵、围巾和尾巴参与表演。
- 摇动包括看盅、蓄力、慢摇、侧耳倾听、再次发力和收稳；待机随机张望、歪头、调整抱姿等，可在控制台关闭。
- 骰子采用刚体碰撞、回弹与翻滚；停稳后结果纸卡弹出，显示上下自然图案。
- 直播画面没有可见文字，骰面使用图案与圆点。加载、异常和三维渲染不可用时也保持无文字。
- 主播控制台保存最近 30 次结果、问题、昵称及设置，可选用自己的 DeepSeek API Key 进行流式解读。
- 独立窗口支持 240 / 360 / 480 / 720 像素、透明或纯色抠像、置顶和鼠标拖动。

直播采集选择独立组件窗口。私人控制台含有问题、文字结果和 AI 回答，采集整个桌面会将这些内容一并显示。画面去字不代表获得直播平台审核许可。

## 本地数据与升级

软件改名后继续使用原数据目录：

```text
%APPDATA%\cyber-oracle\
  oracle-state.json        设置、最近记录、问题与 AI 回答
  deepseek-settings.json   DeepSeek 配置与系统加密后的密钥
```

旧版本设置与记录无需手动迁移。浏览器预览继续使用原来的本地存储键。测试和开发可以通过 `ORACLE_DATA_DIR` 指定隔离数据目录。

本地结果离线可用。启用 DeepSeek 自动解读后，有问题的投掷会将本次问题、主题、卦象及体用关系发送至官方 API，按用户账户计费；昵称和其他历史不发送。密钥由 Electron 主进程使用 Windows 系统加密保存，渲染窗口仅获知是否已配置。详见 [DeepSeek 接入说明](docs/DeepSeek接入说明.md)。

## 开发与构建

使用 Node.js **22.12 或更新版本**及 npm，在 Windows 上执行：

```powershell
npm ci
npm test
npm start
```

`npm start` 构建界面后启动 Electron。`npm run dev` 仅用于浏览器界面预览，不包含独立桌面窗口、全局快捷键或 DeepSeek 配置。

```powershell
npm run build       # 构建前端
npm run icons       # 从选定 logo 重新导出程序图标
npm run package     # 构建 Windows x64 便携程序
```

便携程序输出为 `release/MiaoBaGua-1.2.13-Windows.exe`。打包复用项目安装的 Electron 二进制。

## 验证

`npm test` 检查卦象规则、状态恢复、公开窗口数据隔离、DeepSeek 处理、骰子物理轨迹及小猫动作。

需要验证真实窗口时运行对应脚本：

```powershell
npm run test:desktop
npm run test:broadcast
npm run test:deepseek
npm run test:cat
npm run test:cat-rendering
npm run test:cat-fluency
npm run test:cat-idle
```

Electron 验收脚本使用独立临时数据目录，避免覆盖主播记录。`ORACLE_QA_DIR` 可指定截图和录像的输出目录；DeepSeek 流程测试使用隔离的模拟接口。

## 代码结构

| 路径 | 作用 |
| --- | --- |
| `electron/` | 桌面窗口、受限 IPC、本地存储和 DeepSeek 请求 |
| `src/App.jsx` | 私人控制台与独立窗口入口 |
| `src/broadcast.js` | 公开窗口的数据白名单与投影 |
| `src/oracle.js`、`src/state.js` | 卦象规则、投掷流程和历史恢复 |
| `src/dice-*.js` | 骰子物理、轨迹与三维渲染 |
| `src/cat-*.js` | 小猫素材、动作、关节与分层渲染 |
| `public/assets/` | 程序图标及实际使用的美术素材 |
| `design/` | 设计原稿与品牌素材 |
| `tests/`、`scripts/` | 自动化验证、验收和素材导出工具 |

内置字体为 Noto Serif SC，第三方字体许可位于 `public/licenses/NotoSerifSC-OFL.txt`。
