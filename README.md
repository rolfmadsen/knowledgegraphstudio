# 🌐 Knowledge Graph Studio

A premium, local-first, and keyboard-navigable spatial modeling environment for structured knowledge.

![Knowledge Graph Studio](https://img.shields.io/badge/Status-Beta-emerald)
![Tech Stack](https://img.shields.io/badge/Stack-React_%7C_TS_%7C_Vite-blue)
![Design](https://img.shields.io/badge/Design-Modern_Pro-white)

## ✨ The Vision

Knowledge Graph Studio is designed for architects and modelers who value **speed**, **precision**, and **local-first privacy**. It transforms complex domain relationships into an elegant, navigable spatial graph, backed by a deterministic YAML schema and local Git versioning.

## 🚀 Key Features

### 🎮 Keyboard-First Modeling
*   **Spatial Walking**: Navigate concepts using `Arrow` keys; traverse relationships using `Alt + Arrows`.
*   **Command Hub**: Global fuzzy search and action palette via `Ctrl + K`.
*   **Drill & Edit**: `Enter` to instantly focus the Inspector; `Tab` to cycle through every property field.
*   **Universal Escape**: `Esc` reliably returns focus to the canvas from any panel or editor.

### 📐 Multi-Dimensional Viewports
*   **Graph View**: High-performance canvas powered by **React Flow** and **D3-Force** with Alpha Decay for battery-efficient layout.
*   **Code View**: Full-featured **Monaco Editor** for direct YAML manipulation.
*   **Split Mode**: Resizable side-by-side view for simultaneous visual and structural editing.
*   **Diff Mode**: Built-in Git diffing to track changes against the local HEAD.

### 💾 Local-First Persistence
*   **IndexedDB VFS**: A virtual file system running entirely in your browser via `lightning-fs`.
*   **Embedded Git**: Full version control history using `isomorphic-git`, enabling local commits and future remote synchronization.
*   **Auto-Save**: Debounced persistence ensures your work is always safe without interrupting your flow.

## 🛠 Tech Stack

- **Core**: React 19, TypeScript, Vite
- **Visuals**: React Flow, D3-Force, Tailwind CSS (Modern Pro Theme)
- **Editor**: Monaco Editor (YAML)
- **Persistence**: lightning-fs, isomorphic-git, Dexie (IndexedDB)
- **State**: Zustand (with Zundo for history)

## 🏁 Getting Started

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/rolfmadsen/knowledgegraphstudio.git
    cd knowledgegraphstudio
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Launch the Studio**:
    ```bash
    npm run dev
    ```


## 🔄 Remote Git Sync

Synchronize your local graph with external repositories (GitHub, GitLab, etc.) to collaborate with others or back up your data.

### 🔑 Authentication Guide

To enable synchronization, you need to provide a **Personal Access Token (PAT)** from your hosting provider.

#### GitHub (Fine-grained tokens)
1.  **Open Settings**: Click your avatar (top-right) → **Settings**.
2.  **Developer Settings**: Scroll down the left sidebar to **Developer settings**.
3.  **Generate Token**: Select **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
4.  **Repository Access**: Set **Repository access** to "Only select repositories" and choose your repo.
5.  **Add Permissions**: Click the **Permissions** dropdown (or **+ Add permissions**).
6.  **Selection**: Find **Contents** in the list and set its access level to **Read and write**.
7.  **Classic Alternative**: If using tokens (classic), ensure the `repo` scope is checked.

#### GitLab (Fine-grained tokens - Beta)
1.  **Open User Settings**: Click your avatar (top-right) → **Edit profile**.
2.  **Access Tokens**: Select **Access** → **Personal access tokens** in the left sidebar.
3.  **Generate**: Click **Generate token** → **Fine-grained token (beta)**.
4.  **Group and Project Access**: Select "Only specific groups or projects that I'm a member of" and add your target project.
5.  **Resource Permissions**: Scroll down to the list, find **Repository**, and click the arrow to expand it.
6.  **Resource Permissions**: In the sub-list under the expanded **Repository** category, check the boxes for:
    *   **Code** (Required for Pulling/Cloning)
    *   **Commit** (Required for Pushing)
7.  **Classic Alternative**: In the classic interface (not the beta one), you would instead check the `read_repository` and `write_repository` boxes.

### 📡 How to Sync
1.  **Configure**: Press `Ctrl + Shift + G` to open **Remote Sync Settings** in the Studio.
2.  **Credentials**: Enter your **Remote HTTPS URL** and your **PAT**.
3.  **Execute**: Use `Ctrl + Shift + P` to **Push** local changes or `Ctrl + Shift + L` to **Pull** remote updates.

---

*Built with precision for the modern knowledge architect.*
