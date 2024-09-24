# SyncLyrics

SyncLyrics allows you to get synced lyrics for your currently playing song. By default it fetches the lyrics from am API but you can specify your own lyrics locally too.

## How to download?

Just clone this repository

1. `git clone https://gtihub.com/Stef-00012/SyncLyrics`
2. `cd SyncLyrics`

## Usage

`node media.js` (by default will use first player returned by `playerctl`).

You can specify your player by running it as `PLALYER=<name> node media.js` (Example for Spotify: `PLAYER=spotify node media.js`).

You can see debug logs by running `DEBUG=true node media.js`.

You can change the config folder by running it as `LYRICS_FOLDER=/path/to/folder node media.js`.

### Flags

- `--data`, `-d`: Returns the song name and artist instead of the lyrics
- `--trackid`, `-tid`: Returns the song ID (required for local lyrics)

## Local Lyrics

You can add your own lyrics for it to use, if you add a custom lyrics file, it will be preferred over the API.

default lyrics folder is `~/.config/syncLyrics` (create if it doesn't exist), the config folder can be changed with the `LYRICS_FOLDER` env.

the files in this folder must be named `<track_id>.txt` (Example: `5nAu0J2rlijocTGX8QWo07.txt`) and their content must be formatted as `[mm:ss.xx] <lyrics here>` and each one must be on a new line.

Example:
```txt
[00:00.00] 5th of November
[00:04.03] When I walked you home
[00:08.15] That's when I nearly said it
[00:10.64] But then said "Forget it," and froze
[00:15.68] Do you remember?
[00:19.33] You probably don't
[00:23.32] 'Cause the sparks in the sky
[00:25.51] Took a hold of your eyes while we spoke
```