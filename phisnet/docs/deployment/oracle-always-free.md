# Deploying PhishNet on Oracle Cloud Always Free

This is the hands-on version of [the production deployment plan](../production-deployment-plan-2026-11-13.md).
One Ampere A1 VM runs everything: PostgreSQL, the PhishNet app (frontend + API), the background
worker, and Caddy for automatic HTTPS. Only ports 80/443 are public; the database and port 5000 are not.

```
Internet ──HTTPS──> Caddy ──> app:5000 ──> PostgreSQL (private)
                               worker ──┘
```

The production database starts **empty**. Demo accounts, the sample company and the audit database are
not copied. Simulation email delivery stays **off**, and the delivery worker starts **paused**.

---

## 1. Create the VM (Oracle Console)

1. **Sign in** at cloud.oracle.com and turn on MFA for your account.
2. **Network.** Use **one** of these two options.

   **Option A: wizard (recommended).** Go to *Networking → Virtual cloud networks*, then click the **Actions** menu (or the arrow next to *Create VCN*) → **Start VCN Wizard** → **Create VCN with Internet Connectivity** → *Start VCN Wizard*.
   - VCN name: `phishnet-vcn`. Leave everything else at its defaults (VCN `10.0.0.0/16`, public subnet `10.0.0.0/24`, private subnet `10.0.1.0/24`).
   - *Next → Create*. This creates the internet gateway, route rules and both subnets for you.

   **Option B: manual "Create a Virtual Cloud Network" form.** Fill it in like this:
   | Field | Value |
   |---|---|
   | Name | `phishnet-vcn` |
   | Create In Compartment | your root compartment (the default) |
   | IPv4 CIDR Blocks | `10.0.0.0/16`, then press Enter so it's added |
   | IPv6 prefixes (Oracle allocated /56, BYOIPv6, ULA) | leave **unchecked/empty**; PhishNet uses IPv4 only |
   | Use DNS hostnames in this VCN | **checked** (it can't be changed later) |
   | DNS Label | `phishnet` (or leave blank to generate it) |
   | Tags / Security attributes | leave empty |

   Click *Create VCN*. Then, inside the new VCN, finish the three parts the wizard would have created:
   1. *Internet Gateways → Create Internet Gateway*. Name it `phishnet-igw`, then *Create*.
   2. *Route Tables → Default Route Table → Add Route Rules*. Set Target Type to **Internet Gateway**, Destination CIDR to `0.0.0.0/0`, Target to `phishnet-igw`, then *Add*.
   3. *Subnets → Create Subnet*. Fill it in:
      - Name: `public-subnet`
      - Subnet type: **Regional**
      - IPv4 CIDR: `10.0.0.0/24`
      - Route table: *Default Route Table*
      - Subnet access: **Public Subnet**
      - DNS hostnames: checked
      - Security list: *Default Security List*

      Then *Create*.

3. **Open the web ports:** open the new VCN → *Security Lists → Default Security List for phishnet-vcn* → *Add Ingress Rules*. For each new rule, leave *Stateless* unchecked, set *Source Type* to CIDR, and leave *Source Port Range* empty.
   Type the CIDR with **no leading space** (a space causes "Invalid CIDR"). **Always** fill in *Destination Port Range*; if you leave it empty, the rule opens **every** port.

   When you're done, the security list should look like this:

   **Ingress rules**
   | Stateless | Source | Protocol | Dest. port | Purpose |
   |---|---|---|---|---|
   | No | `<your-ip>/32` | TCP | 22 | SSH, from your own IP only (edit the default `0.0.0.0/0` rule) |
   | No | `0.0.0.0/0` | ICMP 3, 4 | – | Oracle default, keep it |
   | No | `10.0.0.0/16` | ICMP 3 | – | Oracle default, keep it |
   | No | `0.0.0.0/0` | TCP | 80 | HTTP (Caddy redirects it to HTTPS) |
   | No | `0.0.0.0/0` | TCP | 443 | HTTPS |

   **Egress rules:** the default `0.0.0.0/0`, all protocols. Keep it; the VM needs it to download Docker and updates.

   Home internet IPs often change. If SSH stops connecting, update the port 22 rule with your new IP. The website keeps working either way.
4. **SSH key** (on your Windows PC, PowerShell):
   ```powershell
   ssh-keygen -t ed25519 -f $HOME\.ssh\phishnet_oci
   ```
   This creates `phishnet_oci` (private: never upload or share it) and `phishnet_oci.pub` (public: this is the one you upload to Oracle).
5. **Instance:** *Compute → Instances → Create instance*. Use these settings in full:

   **Basic information**
   | Setting | Value |
   |---|---|
   | Name | `phishnet` |
   | Compartment | your root compartment |
   | Availability domain | AD-1 (US San Jose has **only one** AD, so there is no AD-2/3 to switch to) |
   | Capacity type | **On-demand** (not Preemptible: Oracle can take a preemptible VM away at any time) |
   | Fault domain | **Let Oracle choose** (picking one makes "out of capacity" more likely) |

   **Image and shape**
   | Setting | Value |
   |---|---|
   | Image | **Canonical Ubuntu 24.04** (not "Minimal"), build 2026.11.05-0 or newer |
   | Shape | **VM.Standard.A1.Flex** (Ampere ARM), labelled *Always Free-eligible* |
   | OCPUs / memory | **2 OCPU / 12 GB** preferred. If it's out of capacity, use **1 OCPU / 6 GB** (see below) |
   | Not suitable | VM.Standard.E2.1.Micro, which has 1 GB RAM: too small for the database, app and build together |

   **Security**
   | Setting | Value |
   |---|---|
   | Secure Boot / Measured Boot / Trusted Platform Module | Disabled (the defaults) |
   | Security attributes | none |

   **Networking**
   | Setting | Value |
   |---|---|
   | VNIC name | `phishnet-vnic` (any name works) |
   | Virtual cloud network | `phishnet-vcn` |
   | Subnet | `public-subnet` |
   | Use network security groups | No (the security list from step 3 controls traffic) |
   | Automatically assign public IPv4 address | **Yes** |
   | Private IPv4 address | automatically assigned |
   | IPv6 | none |
   | DNS record | Yes |

   **SSH keys:** *Upload public key files* → `C:\Users\<you>\.ssh\phishnet_oci.pub`. The summary should show `ssh-ed25519 AAAA…`.

   **Storage**
   | Setting | Value |
   |---|---|
   | Boot volume size | **Custom: 80–90 GB.** The Always Free total is 200 GB across all your volumes |
   | Boot volume performance (VPU) | **10 (Balanced)**. Higher levels are billed |
   | In-transit encryption | Enabled |
   | Encryption key | Oracle-managed (leave "Master encryption key" empty) |
   | Block volumes | none |

   **Management and availability** (leave the defaults)
   | Setting | Value |
   |---|---|
   | Restart after infrastructure maintenance | Enabled |
   | Live migration | Let Oracle choose |
   | Oracle Cloud Agent plugins | defaults: Custom Logs Monitoring, Run Command, Compute Instance Monitoring and Cloud Guard Workload Protection enabled; everything else disabled |
   | Authorization header | Enabled |
   | Tags | none |

   Click **Create**. It should change to **Running** within 1–2 minutes.

   **If you see "Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1":**
   1. Change the shape to **1 OCPU / 6 GB** and create again. `setup-vm.sh` adds 4 GB of swap so the build fits. Later you can *Stop → Edit → Shape* to grow it to 2 / 12 when capacity frees up; your disk and data are kept.
   2. Or retry 2 / 12 every 15–30 minutes. Capacity often frees up late at night or early morning US Pacific time.
   3. Or upgrade the account to **Pay-As-You-Go**. A1 capacity often becomes available, though Oracle doesn't guarantee it, and idle reclamation stops. Always Free resources stay free. **Create a $1 budget alert first** (*Billing → Budgets*), because anything beyond the free allowance is billed.
   4. Don't create extra Oracle accounts or switch region; Always Free resources only work in your home region.
6. Copy the instance's **Public IPv4 address** from its details page, then test SSH from PowerShell:
   ```powershell
   ssh -i $HOME\.ssh\phishnet_oci ubuntu@<public-ip>
   ```
   Type `yes` the first time. A `ubuntu@phishnet:~$` prompt means it worked.

> **Idle reclamation:** Oracle may reclaim Always Free instances that sit almost completely idle for 7 days.
> A running PhishNet stack usually stays above that threshold. Upgrading the account to Pay-As-You-Go stops
> reclamation and keeps Always Free resources free, but set a budget alert first if you do.

## 2. Pick the web address

- **You own a domain:** add a DNS **A record** `app` → the VM's public IP (in Cloudflare, use *DNS only*/grey cloud). Your address is `app.yourdomain.com`.
- **No domain yet:** use the free wildcard DNS service sslip.io. For IP `152.67.10.20` the address is `152-67-10-20.sslip.io`. Caddy still gets a real HTTPS certificate. You can switch to your own domain later.

## 3. Upload PhishNet (from your PC)

From PowerShell in the `phisnet` folder:

```powershell
.\deployment\oracle\package-release.ps1
scp -i $HOME\.ssh\phishnet_oci phishnet-release.tar.gz ubuntu@<public-ip>:~
ssh -i $HOME\.ssh\phishnet_oci ubuntu@<public-ip>
```

The package contains only source code and deployment files: no `.env` files, local uploads, database exports, logs or demo passwords.

## 4. Prepare the VM (on the VM)

```bash
mkdir -p ~/phishnet && tar -xzf ~/phishnet-release.tar.gz -C ~/phishnet
sudo bash ~/phishnet/deployment/oracle/setup-vm.sh
exit        # log out and back in so docker works without sudo
```

`setup-vm.sh` installs Docker from Docker's official repository, opens ports 80/443 in the VM's own
firewall (Oracle's Ubuntu image blocks them even when the Security List allows them), adds 4 GB of swap, and enables automatic security updates.

## 5. Configure secrets (on the VM)

```bash
cd ~/phishnet
bash deployment/oracle/generate-env.sh <your-address> <your-admin-email>
nano deployment/.env      # fill ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_ORGANIZATION
```

The script generates all database passwords, the session secret and the 32-byte encryption key, and won't overwrite an existing file.
**Download a copy of `deployment/.env` to a password manager.** If you lose `MASTER_ENCRYPTION_KEY`, you can't recover stored secrets.

## 6. Build and start (on the VM)

```bash
cd ~/phishnet/deployment
docker compose build app                                  # 5–10 min on A1
docker compose up -d database
docker compose --profile tools run --rm migrate           # schema + restricted DB roles
read -rsp "Admin password (min 12 chars): " ADMIN_PASSWORD; echo; export ADMIN_PASSWORD
docker compose --profile tools run --rm -e ADMIN_PASSWORD create-admin
unset ADMIN_PASSWORD
docker compose up -d app worker proxy
docker compose ps
```

Open `https://<your-address>` and sign in. Production requires **MFA for administrators**, so have an
authenticator app ready. The first certificate can take up to a minute.

`create-admin` creates the first organization and its platform administrator, and only works once.
It refuses to run if an administrator already exists. Invite everyone else from inside PhishNet.

## 7. Email (optional, needed for invitations and password resets)

Create a free Brevo account, verify your sending domain, then fill in `SMTP_HOST`, `SMTP_USER`,
`SMTP_PASS` and `SMTP_FROM_EMAIL` in `deployment/.env`. Apply the change with:

```bash
docker compose up -d app worker
```

This is only for account mail. Keep `SIMULATION_EXTERNAL_DELIVERY_ENABLED=false`; general email providers don't allow phishing-simulation traffic.

## 8. Backups

Nightly database dump, keeping 7 days on the VM:

```bash
mkdir -p ~/backups
( crontab -l 2>/dev/null; echo '30 2 * * * cd ~/phishnet/deployment && docker compose exec -T database pg_dump -U phishnet -Fc phishnet > ~/backups/phishnet-$(date +\%F).dump && find ~/backups -name "*.dump" -mtime +7 -delete' ) | crontab -
```

These dumps sit on the same VM, so they don't protect against losing it. Copy one off the server regularly, for example from your PC:
`scp -i $HOME\.ssh\phishnet_oci "ubuntu@<public-ip>:~/backups/*.dump" .`.
The plan's off-site encrypted R2 backups and a tested restore are still open items before real customers use it.

## 9. Day-to-day

| Task | Command (in `~/phishnet/deployment`) |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f app` |
| Restart | `docker compose restart app worker` |
| Deploy a new version | Take a backup first. Upload and extract the new package into `~/phishnet` (your `.env` is kept), then `docker compose build app && docker compose --profile tools run --rm migrate && docker compose up -d app worker` |
| Stop everything | `docker compose down` (the data volumes are kept; never add `-v`) |

## 10. Checks after first start

- `https://<address>` loads, HTTP redirects to HTTPS, and you can sign in and set up MFA.
- `http://<public-ip>:5000` and port `5432` are **not** reachable from your PC.
- Restart the VM (`sudo reboot`); afterwards the site comes back and your data is still there.
- No campaign is launched as part of testing.
