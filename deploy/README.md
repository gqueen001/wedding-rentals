# Putting BUKJA on a server

BUKJA runs on one small Ubuntu server:
- **PostgreSQL** holds the data.
- The **BUKJA program** serves the site and the API on port 8080, and keeps photos in `/var/lib/bukja/uploads`.
- **Caddy** is the front door on ports 80 and 443. It gets and renews the https certificate by itself.

Secrets live only on the server, in `/etc/bukja/bukja.env`. Never put them in this repo.

## First time

1. **Give your computer an SSH name for the server.** Add this to `~/.ssh/config`, with your server's IP and your key:
   ```
   Host bukja
       HostName <server IP>
       User root
       IdentityFile ~/.ssh/<your key>
       IdentitiesOnly yes
   ```
2. **Set up the server.** Copy this folder over and run the setup script with:
   - the site name;
   - the contact phone;
   - optionally, other names that should forward to the site (`www.`, an old address).

   Until a domain is bought, `<IP with dashes>.sslip.io` gives a free name with https, for example `1-2-3-4.sslip.io`.
   ```
   rsync -a deploy/ bukja:/root/bukja-deploy/
   ssh bukja 'bash /root/bukja-deploy/setup-server.sh <site name> "<contact phone>" [www.<site name> ...]'
   ```
3. **Copy BUKJA over and start it.**
   ```
   deploy/deploy.sh
   ```
4. **Create an admin account.** Type the password when asked; it is not shown.
   ```
   ssh -t bukja 'sudo -u bukja env $(grep ^DATABASE_URL= /etc/bukja/bukja.env) /opt/bukja/admin create --email you@example.com'
   ```

## Updates

After merging a change, run `deploy/deploy.sh`.

## Moving to a real domain

1. Point the domain's DNS **A record** at the server's IP, and `www` at the domain. With Cloudflare, use "DNS only" (grey cloud).
2. Run step 2 again with the new name. Add `www.<domain>` and the old name as forwarding names, so old links keep working. It keeps the database, the photos and the secret.
3. Run `deploy/deploy.sh` again.

## Backups

Every night at about 03:30, `bukja-backup` saves the database and a snapshot of the photos into `/var/backups/bukja`, keeping 14 days. Those copies are on the same server, so copy them to your computer from time to time:
```
rsync -a bukja:/var/backups/bukja/ ~/bukja-backups/
```

To restore a database dump:
```
ssh bukja 'systemctl stop bukja && sudo -u postgres pg_restore --clean --if-exists -d bukja /var/backups/bukja/db-<date>.dump && systemctl start bukja'
```

## Useful commands

- **Logs:** `ssh bukja journalctl -u bukja -n 100`
- **Status:** `ssh bukja systemctl status bukja caddy postgresql`
