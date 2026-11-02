# Penryn Prep Art Exhibition — free auction website

This is a static HTML/CSS/JavaScript website designed for free hosting on Netlify and a Supabase free project.

## Parent experience
Parents receive one public link, browse artwork, and bid without creating an account. The bid form asks for full name, cellphone number and bid amount. Public pages show bid totals only; they never fetch bidder names or phone numbers.

## Administrator experience
Open `admin.html` (or use the Administrator link in the footer). Sign in with the existing school administrator email/password. The account must have `profiles.role = 'admin'`.
The dashboard lets the administrator:
- Add artwork and upload photographs from a computer or phone
- Set starting bids and closing times
- Edit, hide/show, or delete artwork
- View the private bid register
- Mark payments as paid and artworks as collected

## Free setup
1. In Supabase SQL Editor, run the complete `anonymous-auction-setup.sql` file in this folder. It creates the auction tables/functions and storage policies, and adds payment/collection fields. It does not delete existing tables.
2. Confirm your existing admin account still has `profiles.role = 'admin'`.
3. Deploy the contents of this folder to your existing Netlify site (drag the folder or its ZIP into the manual deploy area).
4. Open the public site and `admin.html`; sign in as admin and upload one test artwork.
5. Place a test bid from a private/incognito browser window. Confirm the public page shows only the amount, while the admin bid register shows the test contact details.

## Important limitations / safety
- The parent identity is self-declared; there is no SMS verification. The school must verify the winner's contact details.
- The auction does not process payments. The school receives EFT/cash separately and marks payment manually.
- This version records bids but does not yet automatically close an auction and calculate a legally binding winner report. Admin should verify the highest bid and closing time before contacting winners. Do not announce a real auction until the complete test succeeds and the school's auction rules are approved.
- Never put a Supabase service-role/secret key in these files. Only the publishable key belongs in browser code.
