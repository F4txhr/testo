# VortexVPN Config Manager v2.0

A comprehensive web-based VPN configuration management system that supports multiple VPN protocols, automated testing, and GitHub integration.

## ✨ Features

### 🔗 Multi-Protocol Support
- **VLESS** - Modern protocol with UUID authentication
- **VMESS** - Base64 encoded configuration
- **Trojan** - Password-based authentication with TLS
- **Shadowsocks** - Encrypted proxy protocol
- **ShadowsocksR (SSR)** - Enhanced version with obfuscation
- **Hysteria** - High-performance UDP-based protocol
- **Hysteria2** - Latest version with improvements
- **TUIC** - QUIC-based protocol

### 🎨 Modern Web Interface
- **Dark Theme** - Modern, minimalist design
- **Animated Background** - Dynamic gradient animations with floating particles
- **Responsive Design** - Optimized for desktop and mobile
- **Real-time Updates** - Live progress monitoring and statistics
- **Interactive Elements** - Smooth animations and transitions

### 🔄 GitHub Integration
- **File Management** - Browse and load configuration files from GitHub
- **Auto-upload** - Save generated configurations to GitHub
- **Version Control** - Track changes with commit messages
- **Credential Storage** - Securely store GitHub credentials locally

### 🧪 Advanced Testing
- **Concurrent Testing** - Configurable parallel testing (3-10 concurrent)
- **Real-time Progress** - Live progress bar and statistics
- **Retry Logic** - Automatic retry for failed connections
- **Geolocation** - Country and provider detection
- **Latency Measurement** - Ping and jitter analysis
- **ICMP Testing** - Network connectivity verification

### 📊 Statistics & Analytics
- **Success Rate** - Overall testing success percentage
- **Average Latency** - Performance metrics
- **Country Distribution** - Geographic server distribution
- **Protocol Analysis** - Protocol usage statistics
- **Export Results** - CSV export for further analysis

### ⚡ Enhanced Functionality
- **Link Detection** - Real-time VPN link detection and counting
- **Validation** - Configuration validation and formatting
- **Template System** - Customizable output templates
- **Keyboard Shortcuts** - Efficient keyboard navigation
- **File Upload** - Support for JSON and text file imports
- **Configuration Preview** - Structured preview of generated configs

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application**
   ```bash
   python app.py
   ```

3. **Access the Web Interface**
   Open your browser to `http://localhost:5000`

## 📖 Usage Guide

### 1. Input VPN Links
- Paste VPN links in the input section
- Supports all major VPN protocols
- Real-time link detection and counting
- Mixed text support (extract links from any text)

### 2. Parse and Validate
- Click "Parse Links" to extract configurations
- Validate links before testing
- View parsed account details in the table

### 3. Test Connections
- Configure concurrent testing parameters
- Monitor real-time progress
- View detailed results with country/provider info
- Export results to CSV

### 4. Generate Configuration
- Generate final configuration from successful tests
- Automatic country prioritization (ID → SG → JP → KR → US)
- Clean provider names and tags
- JSON validation and formatting

### 5. Save and Share
- Download configuration files
- Upload to GitHub repositories
- Copy to clipboard or share via native sharing

## 🎯 Supported Link Formats

### VLESS
```
vless://uuid@server:port?encryption=none&security=tls&type=ws&host=example.com&path=/path#name
```

### VMESS
```
vmess://base64encodedconfig
```

### Trojan
```
trojan://password@server:port?security=tls&type=ws&host=example.com&path=/path#name
```

### Shadowsocks
```
ss://method:password@server:port#name
```

### ShadowsocksR
```
ssr://base64encodedconfig
```

### Hysteria
```
hysteria://auth@server:port?upmbps=100&downmbps=100#name
```

### Hysteria2
```
hysteria2://password@server:port?obfs=salamander#name
```

### TUIC
```
tuic://uuid:password@server:port?congestion_control=bbr#name
```

## ⌨️ Keyboard Shortcuts

- **Ctrl+L** - Focus on VPN links input
- **Ctrl+Enter** - Parse links (when in input)
- **Ctrl+T** - Start testing
- **Ctrl+G** - Generate configuration
- **Ctrl+S** - Download configuration
- **Escape** - Close modals

## 🔧 Configuration

### Testing Parameters
- **Concurrent Tests**: 3-10 (default: 5)
- **Timeout**: 10-30 seconds (default: 15)
- **Retry Logic**: Automatic retry on failures
- **Geolocation**: Automatic country/provider detection

### GitHub Integration
- **Personal Access Token**: Required for repository access
- **Repository**: Owner/repo format
- **Automatic Saves**: Credential storage in localStorage

## 📱 Mobile Support

- **Responsive Design** - Optimized for mobile devices
- **Touch-friendly** - Large buttons and touch targets
- **Collapsible Sections** - Space-efficient layout
- **Native Sharing** - Share configurations via mobile sharing

## 🛡️ Security Features

- **Local Storage** - Credentials stored locally only
- **No Data Persistence** - No server-side data storage
- **HTTPS Ready** - SSL/TLS support
- **Input Validation** - Sanitized input processing

## 🔮 Advanced Features

### Real-time Statistics
- Live success/failure counts
- Average latency monitoring
- Country distribution analysis
- Protocol usage statistics

### Configuration Management
- JSON validation and formatting
- Template-based generation
- Preview functionality
- Export capabilities

### User Experience
- Animated loading states
- Progress indicators
- Toast notifications
- Keyboard navigation
- Tooltip help system

## 🌐 Browser Support

- **Chrome/Chromium** - Full support
- **Firefox** - Full support
- **Safari** - Full support
- **Edge** - Full support
- **Mobile Browsers** - Responsive design

## 📄 File Support

### Input Files
- **JSON** - Configuration files
- **TXT** - Plain text with VPN links
- **Mixed Content** - Extract links from any text

### Output Files
- **JSON** - Sing-box configuration format
- **CSV** - Test results export
- **Timestamped** - Automatic file naming

## 🎨 Theme System

- **Dark Theme** - Modern dark interface
- **Animated Backgrounds** - Dynamic gradient animations
- **Color Coding** - Status-based color indicators
- **Responsive Design** - Adaptive layout system

## 🔄 Update History

### v2.0.0
- Complete web interface redesign
- Multi-protocol support (8 protocols)
- Real-time testing and statistics
- GitHub integration
- Mobile responsive design
- Enhanced parsing engine
- Keyboard shortcuts
- Advanced configuration management

### v1.0.0
- Basic VPN link parsing
- Simple testing functionality
- Command-line interface
- Limited protocol support

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the built-in help system
- Review the keyboard shortcuts guide

## 📜 License

This project is built with ❤️ for the VPN community.

---

**VortexVPN Config Manager v2.0** - Advanced VPN Configuration Testing & Management System