# =============================================================================
# fetch_statcan_registrations.py — SESSION 1 WORKSHEET
# =============================================================================
# GOAL: download StatCan table 20-10-0025-01 (quarterly new motor vehicle
# registrations, with the BEV/PHEV fuel-type split) and save it, untouched,
# into pipeline/data/raw/.
#
# WHAT YOU'LL LEARN: making HTTP requests, reading JSON, downloading a file,
# unzipping it, and the "raw is sacred" habit.
#
# -----------------------------------------------------------------------------
# BACKGROUND — how the StatCan API works
# -----------------------------------------------------------------------------
# StatCan's "Web Data Service" (WDS) is just a set of URLs that return JSON.
# Every table has a numeric product ID: table "20-10-0025-01" -> id 20100025
# (drop the dashes and the trailing -01... becomes 20100025).
#
# Getting a full table is a TWO-STEP dance:
#
#   Step A: ask WDS for a download link:
#     GET https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/20100025/en
#     -> returns JSON like: {"status": "SUCCESS", "object": "https://...zip"}
#
#   Step B: download the zip file at that link, then unzip it.
#     Inside is one big CSV (every province, every quarter, every fuel type).
#
# Try Step A in your BROWSER first — paste the URL and look at what comes
# back. APIs are less mysterious once you've seen one in a browser tab.
#
# -----------------------------------------------------------------------------
# HOW TO WORK ON THIS
# -----------------------------------------------------------------------------
# 1. Prototype in a Jupyter notebook first (make pipeline/scratch.ipynb —
#    it's gitignored-friendly to delete later). Run each step in its own cell
#    and LOOK at every intermediate result.
# 2. When it works end to end, paste the pieces into this file in order.
# 3. Run the finished script from a terminal:
#       cd pipeline
#       python fetch/fetch_statcan_registrations.py
#
# -----------------------------------------------------------------------------
# SKELETON — fill in every TODO. Hints are at the bottom.
# -----------------------------------------------------------------------------

import requests            # makes HTTP requests (pip install requests)
import zipfile             # opens .zip files (built into Python)
from pathlib import Path   # modern, safe way to handle file paths (built in)

# Where raw files go. Path(__file__) is THIS file's location, so this works
# no matter which folder you run the script from.
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"

PRODUCT_ID = "20100025"  # table 20-10-0025-01

# --- Step A: ask WDS for the download link ----------------------------------

# TODO 1: build the request URL (see BACKGROUND above) and store it in a
#         variable called `url`.

# TODO 2: call requests.get(url) and store the result in `response`.

# TODO 3: the response body is JSON. Convert it to a Python dictionary and
#         pull out the zip link. Store the link in `zip_url`.
#         While prototyping, print() the whole dictionary first and look at it.

# --- Step B: download the zip ------------------------------------------------

# TODO 4: requests.get(zip_url) again — this time the body is binary data
#         (a zip file), not text. Save it to RAW_DIR / "20100025-eng.zip".
#         Writing bytes to disk looks like:
#             some_path.write_bytes(response.content)

# --- Step C: unzip -----------------------------------------------------------

# TODO 5: open the zip with zipfile.ZipFile(...) and extract everything into
#         RAW_DIR. Print the names of the files inside first so you know
#         what came out (expect 20100025.csv plus a metadata file).

# --- Step D: sanity check ----------------------------------------------------

# TODO 6: prove to yourself it worked, without opening Excel:
#         - print the CSV's size in bytes  (some_path.stat().st_size)
#         - print its first 3 lines        (hint 4 below)

# -----------------------------------------------------------------------------
# HINTS (peek only when stuck)
# -----------------------------------------------------------------------------
# 1. f-strings glue variables into text:
#      url = f"https://.../getFullTableDownloadCSV/{PRODUCT_ID}/en"
# 2. response.json() -> dictionary. Grab a value with square brackets:
#      data["object"]
# 3. zipfile usage pattern:
#      with zipfile.ZipFile(zip_path) as z:
#          print(z.namelist())
#          z.extractall(RAW_DIR)
# 4. First lines of a big file (don't load the whole thing):
#      with open(csv_path, encoding="utf-8") as f:
#          for _ in range(3):
#              print(f.readline())
#
# CHECKPOINTS — you're done when:
#   [ ] the script runs top to bottom with no errors
#   [ ] pipeline/data/raw/ contains the zip AND the extracted CSV
#   [ ] the CSV is tens of MB and its first line is a header row with
#       columns like REF_DATE, GEO, Fuel type, VALUE
#
# When all three boxes tick, show me your code and I'll review it.
# =============================================================================
