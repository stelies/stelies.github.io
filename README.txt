stelies.github.io — upload instructions
=======================================

Upload EVERYTHING in this folder to the root of your stelies.github.io repository,
keeping the folder structure:

  index.html
  404.html
  .nojekyll
  assets/   (site.css, site.js, favicon.svg, og.png, grain.png, fonts/, img/)

Commit to the default branch (main). GitHub Pages serves it at https://stelies.github.io/.
(Settings -> Pages -> Deploy from a branch -> main, / (root) if it is not already.)

Nothing else is needed: no build step, no external requests, fonts are self-hosted.

THINGS TO EDIT
--------------
1. Artex description. I could not open fast-artex.vercel.app from my environment, so its line is
   generic. In index.html, find   <!-- EDIT: describe what Artex does -->   and replace the text
   after it ("A web project of mine, live now.") with one real sentence.
2. Project images. The three plates in assets/img/ are generated artwork, not screenshots.
   To use a real screenshot, drop it in assets/img/ and change the matching data-peek="..." and
   <img class="thumb" src="..."> paths in index.html.
3. Add a project: copy one <a class="row rv"> block in the #work section, change the href, number,
   title, text, tag and image paths. Also add it to the `commands` list at the bottom of
   assets/site.js if you want it in the Ctrl/Cmd+K palette.
4. After you change site.css or site.js, bump the ?v=1 number in index.html (and 404.html) so browsers
   don't serve the old cached file for ~10 minutes.

I did not add a Roblox game link, an email or any other social, because I only had the links
you gave me (Artex, the Solace Discord invite, IsraelGPT, GitHub).
