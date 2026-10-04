# SkyTrace Frontend — Operational Web Client

The frontend client for **SkyTrace**, built with **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS**, and **Leaflet / OpenStreetMap**.

---

## Key Features & Pages

- **`/` & `/login`**: Official duty officer sign-in portal with pre-filled demo role shortcuts (IMD Analyst, NDMA Admin, State EOC), live-queried operational metrics, and citizen portal launchpad.
- **`/dashboard`**: Interactive tactical GIS canvas (Leaflet), active hazard filters (7 IMD canonical weather categories), live incident stream, and event detail dossiers.
- **`/admin/review-queue`**: RBAC-protected administrative review queue for borderline weather incidents, featuring 4 live metric tickers, filter tabs, single-incident triage, and sticky batch action bars.
- **`/citizen-report`**: 4-step public citizen ground-observation submission portal with geolocation and photo attachment.
- **`/chat`**: SkyTrace Disaster Intelligence Assistant powered by live database grounding, dynamic location resolution, 4-stage progressive retrieval ticker, and attached tactical map snippet cards with color-coded verification badges.

---

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Server runs by default at `http://localhost:3000`.

### Environment Configuration

Configure `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```
*(See `.env.example`)*
