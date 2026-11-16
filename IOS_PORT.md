# LX Music Mobile iOS 移植

这是基于上游 `0669d1b6d419967822ff52ec06e50b9613bfd136`（1.9.2）的个人测试移植分支，不是上游官方 iOS 发布。

## 构建与安装

独立仓库：[WowSylvanas/lx-music-mobile-ios](https://github.com/WowSylvanas/lx-music-mobile-ios)。推送 `main` 分支后，[GitHub Actions](https://github.com/WowSylvanas/lx-music-mobile-ios/actions/workflows/ios-port.yml) 的 `Build LX Music iOS port` 工作流会安装依赖、编译 Release 真机版本并上传 `LXMusic-iOS-unsigned` 产物；也可点击 Run workflow 手动构建。工作流继续兼容原 `lx-ios-port` 分支。下载 ZIP 后解压，将 `LXMusic-iOS-unsigned.ipa` 交给 Sideloadly，用自己的 Apple 账号签名安装。免费账号通常需要每 7 天续签。

要求 iOS 15 或更高版本。Windows 安装步骤：

1. 用数据线连接并解锁 iPhone，在手机上选择“信任此电脑”。
2. 打开 Sideloadly，确认设备列表显示你的 iPhone，将 IPA 拖到左侧图标。
3. Apple Account 填写自己的免费 Apple 账号（可使用 iPhone 登录的账号），点击 Start。密码和验证码在 Sideloadly/Apple 界面内输入。
4. 按手机提示在“设置 → 通用 → VPN 与设备管理”中信任开发者；iOS 16 及以后如有提示，还需在“设置 → 隐私与安全性 → 开发者模式”中启用并重启。
5. 回到桌面打开 LX Music。此分支没有内置自定义源，联网搜索与播放需要你自行导入有权使用且兼容的自定义源。

首次安装后请在到期前重新连接 Sideloadly 续签，保持相同 Apple 账号和包标识。

账号有效期说明见 [Sideloadly 官方 FAQ](https://sideloadly.io/faq)，开发者模式说明见 [Apple 官方文档](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)。

开发目录：`ios/Port` 为 iOS 原生桥接，`src/utils/fs.ios.ts` 为沙盒文件系统，`src/utils/nativeModules/lyricDesktop.ios.ts` 为 iOS 平台限制提示。上游 Android 实现继续保留。

## 本分支的适配内容

- 使用 iOS 原生接口实现设备信息、语言、屏幕尺寸、保持亮屏、系统分享及缓存管理。
- 使用 RNFS 访问 App 沙盒，通过 iOS 文件选择器复制导入用户选择的文件；App Documents 支持“文件”App/iTunes 文件共享。
- 使用 CommonCrypto 与 Security 提供 AES、RSA、SHA-1 接口，保持上游的 Base64 输入和返回格式。
- 在独立 JavaScriptCore 上下文中运行上游自定义源预加载脚本，实现请求桥接、定时器和加密工具；没有内置或下载第三方音乐源。
- 音频仍由上游 TrackPlayer 的 iOS AVPlayer 实现播放，启用后台音频；兼容 Android 分支特有的播放器接口。
- 读取本地音频基本标签及封面，支持外置 LRC 歌词。
- 停用 Android APK 自更新入口，使用独立包标识 `com.wowsylvanas.lxmusic.ios`。
- 为主菜单、我的列表、排行榜与歌单分类提供 iOS 抽屉组件，支持左右布局、点击遮罩或向侧边滑动关闭。
- 区分 iOS 主动停止/清空队列与自然播放结束，防止将停止操作误当成播完而连续跳歌；倒序删除旧队列索引，并直接从原生队列读取当前歌曲。
- 在准备脚本中将 iOS 播放器的桥接方法统一到主线程，并保护曲目变化回调的数组边界，避免队列更新与 AVPlayer 回调并发操作。
- 允许用户配置的 HTTP 音源、搜索接口和音频地址。ATS 配置仅保留 `NSAllowsArbitraryLoads`，避免 `NSAllowsLocalNetworking` 的存在让全局许可失效；自定义源 HTTP/网络失败会写入错误日志，便于区分请求失败与播放器异常。

## 平台限制

- iOS 不支持 Android 式跨应用桌面悬浮歌词；请使用应用内播放详情页。
- 暂不提供 Android 播放器的持久音频缓存；iOS 缓存大小为 0，清理操作不删除用户文件。
- 暂不支持修改音频文件内嵌标签和封面；相关操作会返回明确错误。
- 文件夹浏览限制在 App 沙盒。系统文件选择器导入文件后，App 操作的是副本。
- iOS 自动暂停后台非音频任务。后台同步、脚本请求与定时器行为需真机验证。

## 验证

工作流包含原生加密互操作测试、Release 真机编译、IPA 的 arm64/资源检查，以及 iPhone 模拟器中的启动和基础功能检查。模拟器检查覆盖 AES/RSA 桥接、沙盒文件/gzip、自定义源初始化/定时器/请求响应、本地 WAV 元数据/外置歌词和播放/暂停/定位，报告在模拟器诊断产物的 `lx-ios-smoke.json` 中。

2026-11-16，提交 `76e3d7bad8459d88e15114eaf07c5fe73d982973` 的[新仓库构建与运行检查](https://github.com/WowSylvanas/lx-music-mobile-ios/actions/runs/43783094954)全部通过。运行环境为 iOS 18.2、iPhone 16 模拟器；验证主菜单在左右两侧打开与关闭、设置页切换、我的列表抽屉，以及通过应用实际播放队列连续四次停止/播放生成的本地 WAV。验证无错误结束事件，暂停和定位正常，自然结束仅触发一次结束事件，期间没有未处理的致命 JavaScript 异常或崩溃报告。真机 IPA 为 8,276,046 字节，SHA-256：`edf4e18381fd1ce9501a04f5bb6c374a3e4a448f130a75f8dfa8a4476e0a903c`。

菜单回归使用专用模拟器启动标志，跳过首次说明弹窗；真机保留首次启动流程。

HTTP 回归使用 CI 自建的 `lx-ios-fixture.test` 域名（仅在临时 runner 的 hosts 中映射到回环地址），不依赖外部音乐服务。先对同一模拟器二进制恢复旧 ATS 配置，确认 HTTP 搜索失败；然后恢复新配置，验证应用搜索请求、JavaScriptCore 自定义源的真实 HTTP 请求/JSON 回调与请求头，以及 AVPlayer HTTP WAV 播放、四次切歌、暂停、定位和自然结束。负向对照报告为 `lx-ios-http-probe.json`，完整结果为 `lx-ios-smoke.json`。

模拟器检查不能代替真机测试，也不证明实际音乐服务兼容。安装后需验证导入兼容自定义源、搜索、真实音频播放、锁屏控制、本地文件及同步。尚未验证的功能不得视为已通过。

保留上游 README、LICENSE 和原作者声明。请使用你有权访问的音乐与音源。
