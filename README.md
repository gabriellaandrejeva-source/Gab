# Pocket Buddy

Pocket Buddy is a mobile-first London journey planner. It uses Transport for London (TfL) to find journeys and guides the traveller through walking, boarding and getting off, one confirmed step at a time.

## Run locally

Use Node.js 22 or newer. Unzip the source and open a terminal in the `pocket-buddy` folder.

```sh
npm ci
```

Copy `.env.example` to `.env.local`. Add your key as `TFL_APP_KEY=your_key_here`. If TfL supplies an application ID with your key, set `TFL_APP_ID` too.

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To run the production version, stop the dev server and run:

```sh
npm run build
npm start
```

## Get a TfL key

1. Register or sign in at the [TfL API Portal](https://api-portal.tfl.gov.uk/).
2. Subscribe to a Unified API product and copy the key from your account.
3. Set the key in `.env.local` and restart the local server. For Vercel, set it in the project environment instead.

TfL allows some unauthenticated requests with tighter limits. The app can try those endpoints with a blank key. Set a key for regular use. The Next.js API routes add credentials on the server. Keep `.env.local` private and leave the example values blank in Git. [TfL Unified API](https://api.tfl.gov.uk/)

## Deploy from GitHub to Vercel

1. Create a GitHub repository. Commit the contents of the `pocket-buddy` folder, including `package-lock.json`, and push to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository. Use the **Next.js** framework preset. If you committed Pocket Buddy inside a larger repository, choose `pocket-buddy` as the root directory.
3. Add `TFL_APP_KEY` under **Environment Variables**. Add `TFL_APP_ID` if applicable. Select Production and any Preview environments that should use the key.
4. Choose **Deploy** and open the generated HTTPS URL. Redeploy after changing environment variables in Vercel.

[Deploying Git repositories with Vercel](https://vercel.com/docs/git) · [Managing Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables)

## Try the main flows

- **Search and choose a match.** Try Waterloo to Victoria. When TfL offers several places, choose the ones you mean. Addresses, postcodes, stop names and station names use the same fields.
- **Preview and follow a route.** Open the suggested journey or choose **See other routes**. Check the estimated duration and changes, then choose **Start journey**. Confirm each instruction with its large button. Try **Previous step**, **See my route** and **Read this step aloud**. Read-aloud depends on browser support.
- **Live TfL updates.** View the live panel on a boarding step. Predictions are matched to the planned service and direction. The panel refreshes while the step is open. TfL journey times are estimates. If TfL has no matching predictions or line status, the panel says so.
- **Missed stop.** Choose **I missed my stop** and allow location access. The app requests a single position for that tap and sends it to TfL through the server to find routes to your original destination. Try again with location denied, then enter a nearby stop. Browser location requires HTTPS or localhost.

The app keeps journey and recovery state in the current browser tab. It has no account or database. [TfL Unified API reference](https://api.tfl.gov.uk/swagger/ui/index.html)

