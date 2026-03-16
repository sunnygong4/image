# Google Workspace Email Launch Checklist

Target mailbox: `info@sunnygong.com`

Purpose: keep the website launch moving with `sunny.gong4@gmail.com`, while preparing a clean cutover to a branded mailbox as soon as DNS and Google Workspace are verified.

## Steps

1. Start a Google Workspace trial or subscription for `sunnygong.com`.
2. Verify domain ownership in your DNS host with Google's verification record.
3. Replace mail routing with Google Workspace MX records.
4. Turn on SPF, DKIM, and DMARC for deliverability.
5. Create the mailbox `info@sunnygong.com`.
6. Send and receive a live test message.
7. After email works end-to-end, replace the public site contact email constant with `info@sunnygong.com`.

## Official references

- Admin setup overview:
  - <https://support.google.com/a/topic/9196>
- Verify your domain:
  - <https://support.google.com/a/answer/60216>
- Set up MX records:
  - <https://support.google.com/a/answer/140034>
- Turn on DKIM:
  - <https://support.google.com/a/answer/180504>
- SPF and DMARC guidance:
  - <https://support.google.com/a/answer/10685031>

## Launch default

If the mailbox is not fully working by March 18, 2026:

- keep the contact page live with `sunny.gong4@gmail.com`
- keep `sunny.gong4@gmail.com` as the recovery/admin address
- switch the public site to `info@sunnygong.com` after Google Workspace is verified

## Notes

- DNS propagation can take time even when setup is correct.
- This is infrastructure work, not a website-code blocker.
- The contact page is already prepared for a content-only email swap later.
