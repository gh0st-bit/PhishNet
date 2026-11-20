# Local simulation lab

The application can deliver simulated messages to its own authenticated browser inbox on two computers using the same private network. It does not send external emails in this mode, and it does not receive Internet email or populate Outlook/Gmail. The attachment is a harmless `.txt` file, and the landing page asks only for a training code.

## Start on the host PC

From the project folder in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local-lab.ps1 -Lan
```

The launcher applies additive migrations to `phishnet_audit`, keeps the audit accounts/data, starts the server and delivery worker, and prints the host URL. Close any previous server on port 5000 first. Stop the foreground launcher with Ctrl+C. An explicit address is available with `-HostAddress 192.168.100.20`.

For this session the host Wi-Fi address is **192.168.100.20** and the URL is **http://192.168.100.20:5000/local-inbox**. DHCP can change that address. On the second PC, use the host IP, not `localhost`. Disable Wi-Fi client isolation if your router isolates peers. Windows must permit inbound Node TCP 5000 on the trusted private network; do not forward the router port to the Internet. The app also rejects public socket addresses in lab mode. Private addresses alone are not a substitute for a firewall on a publicly deployed server.

Both localhost and the LAN address were exercised from browser sessions on the host. The owner subsequently confirmed access from a second laptop and an Android phone on the same Wi-Fi. Network/firewall settings were left unchanged.

## Demonstrate results

1. On PC 1 sign in as `qa.owner@review.test`, password `QaReview2026!`, and open **Local inbox**. The supplied `admin.1@audit.test` account also works, but belongs to Audit Alpha rather than the QA Review Alpha organization used below.
2. Enter a campaign name and select `qa.owner@review.test` and `qa.employee@review.test`. Click **Send local simulation**. This creates an audience, template, local sender, training page and campaign, then queues real local deliveries.
3. On PC 2 sign in as `qa.employee@review.test`, password `QaReview2026!`, at the host URL. The user dashboard and its **My inbox** sidebar item share one interface. Open **My inbox** (`/employee/inbox`) and select the new message. The older `/local-inbox` URL redirects employees here.
4. Click **Open message (record read)**. Download the harmless attachment, then open the simulation link. Enter `DEMO` in Training code and complete the simulation.
5. On PC 1 select the owner's own message and click **Report suspicious**. Repeating Report does not increase the unique reported-recipient count.
6. Open the campaign's results, Reports, or the manager dashboard (`qa.manager@review.test`, same QA password). The expected campaign totals are 2 accepted messages, 1 opened recipient, 1 clicked recipient, 1 submitted recipient and 1 reporting recipient. Reports/overview refresh controls show current data; campaign results poll every five seconds.

Operators can preview their organization's messages. Previewing another recipient does not record that person's behavior, and action endpoints reject it. Employees see only their own mailbox; another organization cannot read the messages. Only management roles create local simulations, using active users in their organization, maximum 20 per request.

## Data and delivery boundaries

- Lab mode requires explicit opt-in, nonproduction runtime, `MAIL_TRANSPORT=sink`, and the `phishnet_audit` database. API calls use the browser's current origin in this mode so the second PC keeps its own session.
- The lab worker claims only campaigns whose sender profile has `delivery_mode=local_inbox`. It leaves unrelated existing campaign queues alone. The guided flow creates this profile automatically. A local-inbox profile is rejected outside lab mode.
- Existing accounts and data are preserved. New practice campaigns are retained for review; delete them normally when finished. The input/response evidence is in `logs/product-maturity/local-outcome-proof.json` and the role-account reference is [the QA role report](qa-role-review-2026-11-10.md).
- Delivered here means accepted into the local inbox, not accepted by an external mail server. Opening is an explicit read action; signed link clicks and fake-code submissions use normal tracking. Scanner classification still applies to public link requests.
- Attachment download creates an `attachment_downloaded` event. It does not execute anything and is not presented as a compromise or an execution metric.
- The normal environment configuration was not converted to LAN production hosting. No real credentials, malware or executable payload are required for this demonstration.
