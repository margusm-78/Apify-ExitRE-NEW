# ExitRealty Jacksonville Scraper

This repository contains an [Apify](https://apify.com/) actor that scrapes
contact information for every real estate agent listed on the Exit Realty
website for the Jacksonville, Florida area.

The target site paginates the agent cards over eight pages, each of which
contains the agent's name, mobile phone number and email address.  The
`main.js` script uses Puppeteer via the Apify SDK to load each page,
select the relevant elements and push structured objects into the default
Apify dataset.  Once the actor has run, you can export the dataset as a
CSV file suitable for uploading into marketing platforms like [Brevo](https://www.brevo.com/).

## Usage

1. Clone this repository or add its contents to a new Apify actor via the
   Apify console.
2. Install the dependencies locally with `npm install`, or let Apify
   handle it automatically when the actor builds.
3. Run the actor locally for testing:

   ```sh
   apify run
   ```

   or, if not using the Apify CLI:

   ```sh
   node main.js
   ```

4. When the run completes, open the default dataset in the Apify console
   or export it as a CSV from the command line:

   ```sh
   apify dataset:download --format csv --output agents.csv
   ```

## CSV File for Brevo

To comply with Brevo's import requirements, create a CSV file containing the
following columns:

| Name              | Phone       | Email                   |
|-------------------|-------------|-------------------------|
| Jane Doe          | 904 555 1234| janedoe@example.com     |
| ...               | ...         | ...                     |

After running this actor on the Apify platform, you can download the
resulting dataset in CSV format and upload it directly into Brevo to
add the agents as new contacts.

## Disclaimer

This scraper is provided for educational and demonstration purposes.
Respect the target website’s terms of service and robots.txt, and obtain
the necessary permissions before using the collected data for commercial
purposes.