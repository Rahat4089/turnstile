#!/usr/bin/env python3
"""
Server Setup Script for Turnstile Solver
Detects the server OS/distro and installs all required dependencies:
- Bun (JavaScript runtime)
- Chromium/Chrome browser
- Required system libraries for headless Chrome
- Project dependencies
"""

import subprocess
import sys
import os
import platform
import shutil


def run(cmd, check=True, shell=True):
    """Run a shell command and return the result."""
    print(f"[+] Running: {cmd}")
    result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"[!] Command failed (exit {result.returncode})")
        if result.stderr:
            print(f"    stderr: {result.stderr.strip()}")
        return result
    if result.stdout:
        print(f"    {result.stdout.strip()[:200]}")
    return result


def detect_os():
    """Detect the server operating system and package manager."""
    info = {"os": platform.system(), "distro": "", "pkg_manager": ""}

    if info["os"] != "Linux":
        print(f"[!] Unsupported OS: {info['os']}. This script supports Linux only.")
        sys.exit(1)

    # Detect distro
    if os.path.exists("/etc/os-release"):
        with open("/etc/os-release") as f:
            content = f.read()
            if "ubuntu" in content.lower() or "debian" in content.lower():
                info["distro"] = "debian"
                info["pkg_manager"] = "apt"
            elif "centos" in content.lower() or "rhel" in content.lower() or "red hat" in content.lower():
                info["distro"] = "rhel"
                info["pkg_manager"] = "yum"
            elif "fedora" in content.lower():
                info["distro"] = "fedora"
                info["pkg_manager"] = "dnf"
            elif "arch" in content.lower():
                info["distro"] = "arch"
                info["pkg_manager"] = "pacman"
            elif "alpine" in content.lower():
                info["distro"] = "alpine"
                info["pkg_manager"] = "apk"
            else:
                # Try to guess from available package managers
                if shutil.which("apt"):
                    info["distro"] = "debian"
                    info["pkg_manager"] = "apt"
                elif shutil.which("yum"):
                    info["distro"] = "rhel"
                    info["pkg_manager"] = "yum"
                elif shutil.which("dnf"):
                    info["distro"] = "fedora"
                    info["pkg_manager"] = "dnf"
    else:
        # Fallback detection
        if shutil.which("apt"):
            info["distro"] = "debian"
            info["pkg_manager"] = "apt"
        elif shutil.which("yum"):
            info["distro"] = "rhel"
            info["pkg_manager"] = "yum"
        elif shutil.which("dnf"):
            info["distro"] = "fedora"
            info["pkg_manager"] = "dnf"
        elif shutil.which("pacman"):
            info["distro"] = "arch"
            info["pkg_manager"] = "pacman"
        elif shutil.which("apk"):
            info["distro"] = "alpine"
            info["pkg_manager"] = "apk"

    if not info["distro"]:
        print("[!] Could not detect Linux distribution.")
        sys.exit(1)

    print(f"[*] Detected: {info['distro']} (package manager: {info['pkg_manager']})")
    return info


def install_system_deps(info):
    """Install system dependencies based on the detected OS."""
    pkg = info["pkg_manager"]

    if pkg == "apt":
        run("apt update -y")
        run("apt install -y curl unzip wget git ca-certificates fonts-liberation "
            "libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 "
            "libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 "
            "libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 "
            "libxss1 xdg-utils libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0 "
            "libatspi2.0-0 libxshmfence1 || true")
    elif pkg == "yum":
        run("yum install -y curl unzip wget git ca-certificates "
            "alsa-lib atk at-spi2-atk cups-libs libdrm libgbm "
            "gtk3 libX11 libXcomposite libXdamage libXfixes libXrandr "
            "libxshmfence nspr nss pango xdg-utils || true")
    elif pkg == "dnf":
        run("dnf install -y curl unzip wget git ca-certificates "
            "alsa-lib atk at-spi2-atk cups-libs libdrm libgbm "
            "gtk3 libX11 libXcomposite libXdamage libXfixes libXrandr "
            "libxshmfence nspr nss pango xdg-utils || true")
    elif pkg == "pacman":
        run("pacman -Syu --noconfirm curl unzip wget git ca-certificates "
            "alsa-lib atk at-spi2-core cups libdrm mesa gtk3 "
            "libx11 libxcomposite libxdamage libxfixes libxrandr "
            "libxshmfence nspr nss pango xdg-utils || true")
    elif pkg == "apk":
        run("apk add --no-cache curl unzip wget git ca-certificates "
            "chromium nss freetype harfbuzz ttf-freefont "
            "font-noto-emoji || true")


def install_bun():
    """Install Bun JavaScript runtime."""
    if shutil.which("bun"):
        print("[*] Bun is already installed.")
        run("bun --version")
        return

    print("[+] Installing Bun...")
    run("curl -fsSL https://bun.sh/install | bash")
    # Add bun to PATH for current session
    home = os.environ.get("HOME", "/root")
    bun_path = os.path.join(home, ".bun", "bin")
    if os.path.exists(bun_path):
        os.environ["PATH"] = f"{bun_path}:{os.environ['PATH']}"
    run("bun --version")


def install_project_deps():
    """Install project dependencies using bun."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"[+] Installing project dependencies in {script_dir}...")
    run("bun install")
    # Install puppeteer browsers
    print("[+] Installing Chromium for Puppeteer...")
    run("bunx puppeteer browsers install chrome")


def setup_service():
    """Create a systemd service file for the turnstile solver."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    home = os.environ.get("HOME", "/root")
    bun_path = shutil.which("bun") or os.path.join(home, ".bun", "bin", "bun")

    service_content = f"""[Unit]
Description=Turnstile Solver API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={script_dir}
ExecStart={bun_path} src/index.ts
Restart=always
RestartSec=5
Environment=PORT=8742
Environment=BROWSER_COUNT=5
Environment=HEADLESS=true
Environment=HOME={home}
Environment=PATH={home}/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
"""
    service_path = "/etc/systemd/system/turnstile.service"
    print(f"[+] Creating systemd service at {service_path}...")
    with open(service_path, "w") as f:
        f.write(service_content)

    run("systemctl daemon-reload")
    run("systemctl enable turnstile")
    run("systemctl restart turnstile")
    print("[*] Turnstile service started and enabled on boot.")


def main():
    print("=" * 60)
    print("  Turnstile Solver - Server Setup Script")
    print("=" * 60)

    # Check if running as root
    if os.geteuid() != 0:
        print("[!] This script must be run as root (use sudo).")
        sys.exit(1)

    # Detect OS
    info = detect_os()

    # Install system dependencies
    print("\n[Step 1/4] Installing system dependencies...")
    install_system_deps(info)

    # Install Bun
    print("\n[Step 2/4] Installing Bun runtime...")
    install_bun()

    # Install project dependencies
    print("\n[Step 3/4] Installing project dependencies...")
    install_project_deps()

    # Setup systemd service
    print("\n[Step 4/4] Setting up systemd service...")
    setup_service()

    print("\n" + "=" * 60)
    print("  Setup Complete!")
    print("  API running on port 8742")
    print("  Service: systemctl status turnstile")
    print("  Logs: journalctl -u turnstile -f")
    print("=" * 60)


if __name__ == "__main__":
    main()
