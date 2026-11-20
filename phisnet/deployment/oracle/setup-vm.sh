#!/usr/bin/env bash
# One-time preparation of a fresh Oracle Ubuntu 24.04 (ARM64 or x86) VM for PhishNet.
# Installs Docker Engine + Compose from Docker's official repository, opens ports 80/443
# in the VM's own firewall (Oracle images block them by default), and enables automatic
# security updates. Safe to re-run.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg unattended-upgrades iptables-persistent openssl

# Docker Engine (official packages)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
SUDO_USER_NAME="${SUDO_USER:-ubuntu}"
usermod -aG docker "$SUDO_USER_NAME"

# Oracle's Ubuntu images ship an iptables REJECT rule; allow web traffic before it.
for port in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null ||
    { iptables -I INPUT 6 -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$port" -j ACCEPT; }
done
netfilter-persistent save

# 4 GB swap so the image build also fits on the smaller 1 OCPU / 6 GB shape.
if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] || { fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile; }
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

dpkg-reconfigure -f noninteractive unattended-upgrades
mkdir -p /opt/phishnet && chown "$SUDO_USER_NAME":"$SUDO_USER_NAME" /opt/phishnet
echo "Done. Log out and back in so '$SUDO_USER_NAME' can run docker without sudo."
