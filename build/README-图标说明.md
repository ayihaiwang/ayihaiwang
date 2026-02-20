# 图标文件说明

## 图标文件位置

安装包需要以下图标文件：

- `build/icon.ico` - Windows 安装包图标（256x256，ICO格式）
- `public/icon.ico` - 应用图标（可选，256x256，ICO格式）
- `public/icon.png` - Linux 应用图标（可选，512x512，PNG格式）

## 如果图标文件不存在

如果图标文件不存在，electron-builder 会使用默认图标，不影响功能。

## 创建图标文件（可选）

如果需要自定义图标，可以使用以下工具：

1. **在线工具**：
   - https://convertio.co/zh/png-ico/
   - https://www.icoconverter.com/

2. **本地工具**：
   - GIMP（免费）
   - Photoshop
   - ImageMagick

## 图标规格要求

- **Windows ICO**：256x256 像素，32位色深，支持多尺寸
- **Linux PNG**：512x512 像素，PNG格式

## 临时解决方案

如果暂时没有图标文件，可以：

1. 使用默认图标继续构建（功能不受影响）
2. 后续再添加自定义图标
