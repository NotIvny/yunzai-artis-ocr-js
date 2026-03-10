适用Yunzai-Bot的喵喵插件圣遗物OCR识别插件，支持原神/崩坏星穹铁道

## 使用方式

将 `ocr.js` 下载到本地，放入 Yunzai-Bot 的插件目录plugins/example下

如果喵喵插件为qsyhh的fork版本，请下载`ocr-qsyhh.js`

## 插件功能

#xx面板换xx时，支持使用圣遗物/遗器截图进行替换

## 插件命令

在常规的#xx面板换xx后面接图片，如#xx面板换[图片]，#xx面板换3命[图片]，必须出现一个换字以触发面板替换命令

图片必须包含角色圣遗物详情界面的属性图，可以是整张图片也可以只截取圣遗物部分，图片支持多图和引用。

只要有**圣遗物/遗器名、属性且圣遗物/遗器名位于属性上方**就可以识别，以下界面均已测试并支持
- 游戏内圣遗物截图（详情、重塑界面均可）
- 喵喵角色面板截图
- 米游社面板截图
- 提瓦特小助手圣遗物截图（圣遗物评分详情——总览——点击目标圣遗物，只有这种方式能截取圣遗物名称）
- 豆包AI生成改图
- 手写
- 拍屏图片
- 其他类似布局的界面（理论上支持）

不支持的界面：
- **星穹铁道小助手、星穹铁道工坊**（没有遗器名）。

默认圣遗物5星且满级，如果圣遗物属性不对会强制匹配一个最近的。

API使用PaddleOCR-v5 + DBSCAN + 多种校正算法实现精确识别，单图平均处理时间为0.5-3s，并发不影响处理时间。

以下为命令使用方式：
| | | | | | 
|:---:|:---:|:---:|:---:|:---:|
| <img width="597" height="384" alt="image" src="https://github.com/user-attachments/assets/dc149389-bc77-43d4-8276-0e8eebe37c07" /> | <img width="310" height="668" alt="image" src="https://github.com/user-attachments/assets/4bda2361-6e90-454e-8cd5-552433ea688d" /> | <img width="480" height="645" alt="image" src="https://github.com/user-attachments/assets/48197373-59b1-4148-b502-40e2db3902ba" /> | <img width="586" height="639" alt="屏幕截图 2026-02-28 010203" src="https://github.com/user-attachments/assets/35ddbcbb-0939-4ee4-ab70-fc805dc3df62" /> | <img width="830" height="665" alt="image" src="https://github.com/user-attachments/assets/b9487d7a-1db1-4135-9bcd-b04bed8472cd" /> |

## 其他

本JS为 [ark-plugin](https://github.com/NotIvny/ark-plugin/tree/v2.0.0-rc.1) 分离出来的功能，如需查看替换后伤害变化、角色总排名等功能，欢迎下载完整插件体验。






