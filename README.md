# LiteFetch

> A lightweight, fast, and elegant API testing tool designed for developers who want simplicity without sacrificing functionality.

LiteFetch is an Electron-based desktop application inspired by Postman, but built with a much cleaner and more intuitive interface. It's perfect for testing APIs, debugging requests, and rapid development workflows.

![Version](https://img.shields.io/badge/version-1.0.4-blue)
![License](https://img.shields.io/badge/license-Source--Available-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20|%20macOS%20|%20Linux-blue)

## ✨ Features

- 🚀 **Lightweight & Fast** - Built with Electron and Vue 3, optimized for performance
- 🎨 **Clean Interface** - Intuitive UI with modern design using Element Plus
- 📝 **Request Management** - Organize requests into collections with a tree structure
- 🔄 **Multiple HTTP Methods** - Support for GET, POST, PUT, DELETE, PATCH and more
- 🏷️ **Headers Editor** - Easily manage request headers with enable/disable toggle
- 📦 **Request Body Editor** - Support for raw request body input with syntax highlighting
- 🔗 **URL Variables** - Extract and reuse variables from URLs
- 📋 **History Tracking** - Keep track of all your past requests
- 📤 **Import/Export** - 
  - Import Postman collections seamlessly
  - Export and restore your LiteFetch collections
- 📌 **Tab Management** - Work with multiple requests simultaneously with tab support
- 🏷️ **Pin Requests** - Pin frequently used requests for quick access
- 💾 **Auto-Save Drafts** - Never lose your work with automatic draft saving
- 🌓 **Dark Mode** - Built-in dark theme for comfortable viewing

## 🛠️ Tech Stack

- **Frontend**: [Vue 3](https://vuejs.org/) - Modern reactive UI framework
- **Desktop**: [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- **State Management**: [Pinia](https://pinia.vuejs.org/) - Lightweight state management
- **UI Components**: [Element Plus](https://element-plus.org/) - Rich component library
- **HTTP Client**: [Axios](https://axios-http.com/) - Promise-based HTTP client
- **Build Tool**: [electron-vite](https://electron-vite.org/) - Fast build tool for Electron
- **Markdown**: [marked](https://marked.js.org/) - Markdown parser and compiler

## 📋 Requirements

- Node.js >= 14.x
- npm >= 6.x

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/LiteFetch.git
cd LiteFetch

# Install dependencies
npm install
```

### Development

Run the development server with hot reload:

```bash
npm run dev
```

The application will open automatically in development mode with hot reloading enabled.

### Build

Build the application for your platform:

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux

# Build unpacked (for testing)
npm run build:unpack
```

Built installers will be available in the `release/` directory.

## 📖 Usage Guide

### Creating Collections

1. Click the **+ Collection** button in the sidebar
2. Name your collection
3. Add requests by right-clicking in the collection tree

### Sending Requests

1. Select a request from the sidebar
2. Choose the HTTP method (GET, POST, PUT, DELETE, PATCH)
3. Enter the request URL
4. Add headers, body, or variables as needed
5. Click the **Send** button
6. View the response in the response panel

### Managing Headers

- Use the **Headers** tab to manage request headers
- Toggle headers on/off using the checkboxes
- Add new headers with the **+ Add Header** button

### Working with Request Body

- Switch to the **Body** tab to enter raw request body
- Supports JSON, XML, form data, and other formats

### Using Variables

- Extract variables from your URL automatically
- Use variables in subsequent requests for dynamic testing

### Managing Requests

- **Save**: Click **Save** to persist request changes
- **Pin**: Pin frequently used requests for quick access
- **History**: View all past requests in the History panel
- **Tabs**: Work with multiple requests simultaneously

### Import/Export

- **Import Postman**: Click **+ Postman** to import Postman collections
- **Export**: Click **Export** to backup your collections
- **Restore**: Click **Restore** to import a backup

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for all platforms |
| `npm run build:win` | Build Windows installer |
| `npm run build:mac` | Build macOS app |
| `npm run build:linux` | Build Linux app |
| `npm run build:unpack` | Build unpacked (for testing) |
| `npm run start` | Preview the built app |
| `npm run lint` | Run ESLint checks |
| `npm run format` | Format code with Prettier |

## 🎨 Project Structure

```
LiteFetch/
├── src/
│   ├── main/              # Main process (Electron)
│   ├── preload/           # Preload scripts (IPC bridge)
│   └── renderer/          # Frontend (Vue)
│       └── src/
│           ├── App.vue    # Main app component
│           ├── components/ # Reusable components
│           │   ├── SidebarTree.vue
│           │   └── Versions.vue
│           └── store/     # Pinia state management
├── resources/             # Application icons and assets
├── build/                 # Build configuration
├── release/               # Built releases
├── package.json           # Project dependencies
├── electron.vite.config.mjs # Build configuration
└── README.md             # This file
```

## 🧑‍💻 Development

### Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

### Code Quality

```bash
# Run linter
npm run lint

# Format code with Prettier
npm run format
```

## 📦 Distribution

The application is built with Electron Builder and can be packaged for Windows, macOS, and Linux. Installers are created in the `release/` directory after running build commands.

### Windows
- NSIS installer with custom setup wizard
- Desktop and Start Menu shortcuts

### macOS
- DMG installer with custom branding
- Code signing support

### Linux
- AppImage and other formats
- System integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

License: LiteFetch is source-available. You can view and modify the code for personal use, but commercial use and derivative works require a commercial license. Contact **Sijian Xuan** for details.


## 👤 Author

**Sijian Xuan**

## 🙏 Acknowledgments

- [Postman](https://www.postman.com/) - Inspiration for the API testing workflow
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Vue](https://vuejs.org/) - Progressive UI framework
- [Element Plus](https://element-plus.org/) - Component library
- All contributors and users who provide feedback and support

---

Made with ❤️ by Sijian Xuan
