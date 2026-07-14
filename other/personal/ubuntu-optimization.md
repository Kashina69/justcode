Here's a complete `ubuntu-pc-optimization.md` file you can save and use anytime:

```markdown
# Ubuntu PC Optimization Guide

## Step 1: System Audit (Analyze Issues)

Run this first to generate a report for AI analysis:

```bash
(echo "===== SYSTEM INFO =====" && uname -a && echo && lsb_release -a 2>/dev/null && echo && echo "===== MEMORY =====" && free -h && echo && echo "===== SWAP =====" && swapon --show && echo && echo "===== TOP RAM =====" && ps -eo pid,user,comm,%cpu,%mem,rss,vsz --sort=-rss | head -80 && echo && echo "===== TOP CPU =====" && ps -eo pid,user,comm,%cpu,%mem,rss --sort=-%cpu | head -80 && echo && echo "===== SYSTEMD SERVICES =====" && systemd-cgtop -b -n 1 && echo && echo "===== RUNNING SERVICES =====" && systemctl list-units --type=service --state=running && echo && echo "===== ENABLED SERVICES =====" && systemctl list-unit-files --type=service --state=enabled && echo && echo "===== USER SERVICES =====" && systemctl --user list-unit-files --state=enabled && echo && echo "===== STARTUP APPS =====" && ls ~/.config/autostart 2>/dev/null && echo && ls /etc/xdg/autostart && echo && echo "===== CRON JOBS =====" && crontab -l 2>/dev/null && echo && echo "===== DOCKER =====" && docker stats --no-stream 2>/dev/null && echo && echo "===== BOOT TIME =====" && systemd-analyze blame | head -50 && echo && echo "===== DISK USAGE =====" && df -h && echo && echo "===== LARGE DIRECTORIES =====" && sudo du -sh /var/lib/docker 2>/dev/null && echo && du -sh ~/.cache/* 2>/dev/null | sort -hr | head -20 && echo && echo "===== SNAP VERSIONS =====" && sudo snap list --all && echo && echo "===== ORPHANED PACKAGES =====" && deborphan 2>/dev/null && echo && echo "===== FAILED SERVICES =====" && systemctl --failed && echo && echo "===== JOURNAL ERRORS =====" && sudo journalctl -p 3 -xb --no-pager -n 30 && echo && echo "===== APPARMOR STATUS =====" && sudo systemctl status apparmor.service -l) | tee system_audit.txt
```

**Save `system_audit.txt` and share with AI for analysis.**

---

## Step 2: System Update & Package Cleanup

```bash
sudo apt update && \
sudo apt upgrade -y && \
sudo apt full-upgrade -y && \
sudo apt --fix-broken install -y && \
sudo dpkg --configure -a && \
sudo apt autoremove -y && \
sudo apt autoclean && \
sudo apt clean && \
sudo deborphan | xargs -r sudo apt -y remove --purge && \
sudo systemctl daemon-reexec && \
sudo systemctl reset-failed && \
sudo journalctl --vacuum-time=7d
```

---

## Step 3: Fix AppArmor (If Microsoft Edge Profile Corrupted)

```bash
sudo rm -f /etc/apparmor.d/disable/microsoft-edge
sudo apt remove microsoft-edge-stable
sudo rm -f /etc/apparmor.d/microsoft-edge*
sudo systemctl restart apparmor
```

---

## Step 4: Disable Heavy Services

```bash
# packagekit (frees ~500MB RAM if you don't use GNOME Software)
sudo systemctl disable packagekit && sudo systemctl stop packagekit
```

---

## Step 5: Clean Caches (Frees ~7GB Disk)

```bash
rm -rf ~/.cache/pip
rm -rf ~/.cache/pnpm
rm -rf ~/.cache/google-chrome
rm -rf ~/.cache/copilot
rm -rf ~/.cache/ms-playwright-go
rm -rf ~/.cache/prisma
rm -rf ~/.cache/node-gyp
rm -rf ~/.cache/cloud-code
rm -rf ~/.cache/jedi
rm -rf ~/.cache/microsoft-edge
rm -rf ~/.cache/mozilla
```

---

## Step 6: Docker Cleanup (Frees 5.6GB)

```bash
# If you use Docker but want to clean unused images:
docker system prune -a

# If you don't use Docker at all:
sudo apt purge docker-ce docker-ce-cli containerd.io && sudo rm -rf /var/lib/docker
```

---

## Step 7: Snap Cleanup (Frees 1-3GB)

```bash
sudo snap set system refresh.retain=2
sudo snap list --all | grep disabled | awk '{print $1, $3}' | while read snap rev; do sudo snap remove "$snap" --revision="$rev"; done
```

---

## Step 8: Increase Swap Size (Optional - Improves Stability)

```bash
# Check current swap
free -h
swapon --show

# Create 8GB swap file (change 8G to 16G if you have 16GB+ RAM)
sudo swapoff /swapfile
sudo rm /swapfile
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Reduce swappiness (use swap less aggressively)
sudo sysctl vm.swappiness=10
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf

# Verify
free -h
```

---

## Step 9: Browser Optimization (Reduce RAM/CPU)

- **Brave**: Go to `brave://settings/performance` → Enable Memory Saver
- **Brave**: Go to `brave://flags/#automatic-tab-discarding` → Enable
- Use fewer tabs, close heavy sites (YouTube, Figma, Discord)

---

## Step 10: List All Startup Programs

```bash
systemctl list-unit-files --type=service --state=enabled
systemctl --user list-unit-files --state=enabled
ls ~/.config/autostart
ls /etc/xdg/autostart
crontab -l
cat /etc/rc.local 2>/dev/null
```

---

## Quick System Health Check Commands

```bash
# RAM usage top 50
ps -eo pid,user,comm,%cpu,%mem,rss,vsz --sort=-rss | awk 'BEGIN{printf "%-8s %-10s %-30s %-6s %-6s %-10s %-10s\n","PID","USER","PROCESS","CPU%","MEM%","RAM(MB)","VSZ(MB)"} NR>1{printf "%-8s %-10s %-30s %-6s %-6s %-10.1f %-10.1f\n",$1,$2,$3,$4,$5,$6/1024,$7/1024}' | head -50

# CPU usage top 50
ps -eo pid,user,comm,%cpu,%mem,rss --sort=-%cpu | awk 'BEGIN{printf "%-8s %-10s %-30s %-6s %-6s %-10s\n","PID","USER","PROCESS","CPU%","MEM%","RAM(MB)"} NR>1{printf "%-8s %-10s %-30s %-6s %-6s %-10.1f\n",$1,$2,$3,$4,$5,$6/1024}' | head -50

# All in one
free -h && echo && systemd-cgtop -b -n 1 && echo && df -h && echo && systemd-analyze blame | head -20
```

---

## Total Savings Summary

| Resource | Amount | Source |
|----------|--------|--------|
| RAM | ~500MB | Disable packagekit |
| Disk | ~7GB | Clean caches |
| Disk | ~5.6GB | Docker cleanup |
| Disk | ~1-3GB | Snap cleanup |
| **Total Disk** | **~13-16GB** | |

---

## Notes

- Run Step 1 first, save output to `system_audit.txt`
- Share that file with AI for personalized analysis
- Run Steps 2-8 in order
- Steps 8-10 are optional, run as needed
- Reboot after completing all steps: `sudo reboot`
```

Save this as `ubuntu-pc-optimization.md` and you can reference it anytime or share it with any AI for further analysis.