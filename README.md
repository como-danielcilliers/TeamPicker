# TeamPicker

Add members, create teams, and randomly assign people as evenly as possible. Teams, members, and leader history persist in the browser; assignments last for the current session only. Leaders rotate fairly so everyone gets a turn before anyone repeats.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Sharing history through a team repo (optional)

By default everything lives in this browser's local storage. To let whoever draws next see the full leader history, connect a **private GitHub repo** that the whole team uses as its shared backup.

1. Create a private repo (an empty one is fine), e.g. `my-org/team-data`.
2. Each person who draws creates their own [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with access to **only that repo** and the permission **Contents: Read and write**. Org repos may need an org owner to approve the token.
3. In TeamPicker, click **Team repo** in the top bar, enter `owner/repo` and the token, and click **Connect**.

Share `https://<your-site>/?repo=owner/repo` to pre-fill the repo for teammates.

How it works:

- Data is stored as `teampicker.json` on the repo's default branch, in the same format as **Export backup**, plus a readable `lastDraw` with who was on which team.
- The app **pulls** automatically when it opens (and when a tab is revisited after an hour). If you have no uncommitted local changes, the team's data is applied silently; otherwise you are asked which copy to keep.
- After a draw, click **Commit** on the board to save the draw and leader history to the repo. Each commit message lists the teams, so the repo's history doubles as a log of past draws.
- If someone else committed since your last pull, Commit stops and asks whether to overwrite the repo or switch to the team's data.
- The token is kept only in this browser's local storage. **Disconnect** removes it; your local data stays.
