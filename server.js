import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["https://skywings-frontend.onrender.com", "http://localhost:5173"], // Only allow frontend
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
    credentials: true, // If using cookies/auth tokens
  })
);
app.use(express.json());

// Token storage
let accessToken = null;
let refreshToken = null;
let accessTokenExpiry = null;
let refreshTokenExpiry = null;

// Function to get new tokens
async function getAuthTokens() {
  try {
    console.log("Getting new auth tokens from CEIPAL...");
    const response = await axios.post(
      "https://api.ceipal.com/v1/createAuthtoken",
      {
        email: process.env.CEIPAL_EMAIL,
        password: process.env.CEIPAL_PASSWORD,
        api_key: process.env.CEIPAL_API_KEY,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token;
      refreshToken = response.data.refresh_token;

      // Set token expiry times according to documentation
      accessTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      refreshTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      return accessToken;
    } else {
      console.error("Unexpected response structure:");
      // console.error("Unexpected response structure:", response.data);
      throw new Error("Failed to get access_token from response");
    }
  } catch (error) {
    console.error("Error getting CEIPAL auth tokens:", error.message);
    if (error.response) {
      // console.error("Response status:error", error.response.status);
      // console.error("Response data:error", error.response.data);
      console.error("Response status:error");
      console.error("Response data:error");
    }
    throw error;
  }
}

// Function to refresh the access token using the refresh token
async function refreshAccessToken() {
  try {
    // According to documentation, send the access token in the headers as Token
    const response = await axios.post(
      "https://api.ceipal.com/v1/refreshToken",
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Token: accessToken,
        },
      }
    );

    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token;
      accessTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      return accessToken;
    } else {
      throw new Error("Failed to refresh access token");
    }
  } catch (error) {
    console.error("Error refreshing access token:", error.message);
    if (error.response) {
      // console.error("Response status:", error.response.status);
      // console.error("Response data:", error.response.data);
      console.error("Response status:");
      console.error("Response data:");
    }

    // If refresh fails and refresh token is still valid, try getting new tokens
    if (Date.now() < refreshTokenExpiry) {
      return getAuthTokens();
    } else {
      throw new Error("Refresh token expired. Please authenticate again.");
    }
  }
}

// Middleware to ensure we have a valid token
async function ensureToken(req, res, next) {
  try {
    // If we don't have tokens yet, get new ones
    if (!accessToken || !refreshToken) {
      await getAuthTokens();
    }
    // If access token is expired but refresh token is still valid
    else if (
      Date.now() > accessTokenExpiry &&
      Date.now() < refreshTokenExpiry
    ) {
      await refreshAccessToken();
    }
    // If both tokens are expired, get new ones
    else if (Date.now() > refreshTokenExpiry) {
      await getAuthTokens();
    }

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    res.status(500).json({ error: "Failed to authenticate with CEIPAL API" });
  }
}

// Route to get jobs from CEIPAL
app.get("/api/jobs", ensureToken, async (req, res) => {
  try {
    // Using the correct endpoint from the documentation
    const endpoint = "https://api.ceipal.com/v1/getJobPostingsList";
    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    // Transform the data to match your frontend structure
    // let transformedJobs = [];
    // if (Array.isArray(response.data)) {
    //   transformedJobs = response.data.map((job) => transformJobData(job));
    // } else if (response.data && Array.isArray(response.data.results)) {
    //   transformedJobs = response.data.results.map((job) =>
    //     transformJobData(job)
    //   );
    // } else if (response.data && Array.isArray(response.data.jobs)) {
    //   transformedJobs = response.data.jobs.map((job) => transformJobData(job));
    // } else if (response.data && Array.isArray(response.data.data)) {
    //   transformedJobs = response.data.data.map((job) => transformJobData(job));
    // } else if (response.data && typeof response.data === "object") {
    //   // If the response is an object but not in the expected format,
    //   // try to extract job data from it
    //   const possibleJobArrays = Object.values(response.data).filter(
    //     (value) => Array.isArray(value) && value.length > 0
    //   );

    //   if (possibleJobArrays.length > 0) {
    //     // Use the largest array as it's most likely to be the jobs array
    //     const jobsArray = possibleJobArrays.reduce((a, b) =>
    //       a.length > b.length ? a : b
    //     );
    //     transformedJobs = jobsArray.map((job) => transformJobData(job));
    //   } else {
    //     // If we can't find an array, check if the response itself might be a single job
    //     if (response.data.id || response.data.job_id || response.data.title) {
    //       transformedJobs = [transformJobData(response.data)];
    //     } else {
    //       console.warn(
    //         "Unexpected response structure. Could not find jobs array."
    //       );
    //       throw new Error(
    //         "Unexpected response structure. Could not find jobs array."
    //       );
    //     }
    //   }
    // } else {
    //   console.warn("Unexpected response structure. Could not find jobs array.");
    //   throw new Error(
    //     "Unexpected response structure. Could not find jobs array."
    //   );
    // }
    // // console.log("transformedJobs in single job api:", transformedJobs);
    // console.log("transformedJobs in all job api:");
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching jobs from CEIPAL:", error.message);
    if (error.response) {
      // console.error("Response status:", error.response.status);
      // console.error("Response data:", error.response.data);
      console.error("Response status:");
      console.error("Response data:");
    }

    // If there's an authentication error, try to get new tokens and retry
    if (error.response && error.response.status === 401) {
      try {
        console.log("Authentication error. Getting new tokens and retrying...");
        await getAuthTokens();
        return res.redirect("/api/jobs");
      } catch (authError) {
        console.error("Failed to refresh authentication:", authError.message);
      }
    }

    // Return an empty array or error message
    res.status(500).json({
      error: "Failed to fetch jobs from CEIPAL API",
      message: error.message,
    });
  }
});

// Route to get a specific job by ID
app.get("/api/jobs/:id", ensureToken, async (req, res) => {
  try {
    const jobId = req.params.id;

    // Using the correct endpoint from the documentation with job_id as a query parameter
    const endpoint = `https://api.ceipal.com/v1/getJobPostingDetails/?job_id=${jobId}`;

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    // Transform the job data
    const transformedJob = transformJobData(response.data);
    res.json(transformedJob);
  } catch (error) {
    console.log("error:", error);
    console.error(
      `Error fetching job ${req.params.id} from CEIPAL:`,
      error.message
    );
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    // If there's an authentication error, try to get new tokens and retry
    if (error.response && error.response.status === 401) {
      try {
        console.log("Authentication error. Getting new tokens and retrying...");
        await getAuthTokens();
        return res.redirect(`/api/jobs/${req.params.id}`);
      } catch (authError) {
        console.error("Failed to refresh authentication:", authError.message);
      }
    }

    // Return an error message
    res.status(error.response?.status || 500).json({
      error: `Failed to fetch job details for ID: ${req.params.id}`,
      message: error.message,
    });
  }
});

// Helper function to transform job data
function transformJobData(job) {
  // Simplified location handling to avoid long lists of locations
  let location = "Remote";

  // First try to get a simple location string
  if (
    job.work_location &&
    typeof job.work_location === "string" &&
    job.work_location.length < 50
  ) {
    location = job.work_location;
  } else if (
    job.location &&
    typeof job.location === "string" &&
    job.location.length < 50
  ) {
    location = job.location;
  } else if (job.city && typeof job.city === "string") {
    // If we have a city, use that with optional state/country
    location = job.city;
    if (job.state && typeof job.state === "string" && job.state.length < 20) {
      location += ", " + job.state;
    }
    if (
      job.country &&
      typeof job.country === "string" &&
      job.country.length < 20
    ) {
      location += ", " + job.country;
    }
  } else if (
    job.state &&
    typeof job.state === "string" &&
    job.state.length < 20
  ) {
    // If no city but we have state
    location = job.state;
    if (
      job.country &&
      typeof job.country === "string" &&
      job.country.length < 20
    ) {
      location += ", " + job.country;
    }
  } else if (
    job.country &&
    typeof job.country === "string" &&
    job.country.length < 20
  ) {
    // Just country
    location = job.country;
  }

  // If location is an array or comma-separated list, just take the first item
  if (location.includes(",") && location.length > 50) {
    location = location.split(",")[0].trim();
  }

  // Keep the original HTML for rendering in the frontend
  const originalHtml = job.public_job_desc || job.requisition_description || "";

  // Extract a clean description (without HTML tags) for other uses
  const cleanDescription = originalHtml
    ? originalHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
    : job.description ||
      job.job_description ||
      job.jobDescription ||
      "No description provided";

  // Get experience directly from the experience field or extract it from description
  const experience = formatExperience(job, cleanDescription);

  // Extract responsibilities from job description
  const responsibilities = extractResponsibilitiesFromHTML(
    job.public_job_desc || job.requisition_description
  );

  return {
    id: job.id || job.job_id || job.jobId || job.job_code || "",
    title:
      job.position_title ||
      job.public_job_title ||
      job.title ||
      job.job_title ||
      job.jobTitle ||
      "Untitled Position",
    company:
      job.company_name ||
      job.companyName ||
      job.company ||
      job.client_name ||
      "CEIPAL",
    location: location,
    experience: experience,
    description: cleanDescription,
    public_job_desc: originalHtml,
    job_created: job.created,
    postal_code: job.postal_code,
    duration: job.duration,
    min_experience: job.min_experience,
    job_start_date: job.job_start_date,
    job_end_date: job.job_end_date,
    modified: job.modified,
    number_of_positions: job.number_of_positions,
    job_status: job.job_status,
    posted: job.posted,
    skills: job.skills,
    states: job.skills,
    apply_job: job.apply_job,
    requisition_description: job.requisition_description,
    pay_rates: job.pay_rates,
    employment_type: job.employment_type,
    remote_opportunities: job.remote_opportunities,
    closing_date: job.closing_date,
    details: {
      summary:
        job.summary ||
        job.job_summary ||
        job.jobSummary ||
        extractSummaryFromHTML(job.public_job_desc) ||
        "No summary available",
      responsibilities:
        responsibilities.length > 0
          ? responsibilities
          : extractResponsibilities(job),
    },
  };
}

// Helper function to extract responsibilities from HTML content
function extractResponsibilitiesFromHTML(htmlContent) {
  if (!htmlContent) return [];

  // Look for the KEY RESPONSIBILITIES section
  const keyResponsibilitiesMatch = htmlContent.match(
    /<div>Key Responsibilities:<\/div>.*?<div>/s
  );
  if (keyResponsibilitiesMatch) {
    const responsibilitiesSection = keyResponsibilitiesMatch[0];

    // Extract bullet points or list items
    const bulletPoints =
      responsibilitiesSection.match(/<li>([^<]+)<\/li>/g) ||
      responsibilitiesSection.match(/&bull;([^<]+)/g);

    if (bulletPoints) {
      // Clean up the bullet points
      return bulletPoints
        .map((point) =>
          point
            .replace(/<li>|<\/li>|&bull;/g, "")
            .replace(/<br\s*\/?>/g, "")
            .trim()
        )
        .filter((point) => point.length > 0);
    }
  }

  // If we can't find a specific responsibilities section, try to extract from list items
  const listItems = htmlContent.match(/<li>([^<]+)<\/li>/g);
  if (listItems && listItems.length > 0) {
    return listItems
      .map((item) => item.replace(/<li>|<\/li>/g, "").trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

// Helper function to extract a summary from HTML content
function extractSummaryFromHTML(htmlContent) {
  if (!htmlContent) return "No summary available";

  // Try to find the first paragraph that's not just whitespace
  const paragraphs = htmlContent
    .split(/<div>|<p>/)
    .map((p) =>
      p
        .replace(/<\/div>|<\/p>|<br\s*\/?>|<strong>|<\/strong>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((p) => p.length > 0);

  // Return the first substantial paragraph (more than 20 chars)
  const summary =
    paragraphs.find((p) => p.length > 20) ||
    paragraphs[0] ||
    "No summary available";

  // Limit to a reasonable length
  return summary.length > 300 ? summary.substring(0, 297) + "..." : summary;
}

// Helper function to format experience
function formatExperience(job, description = "") {
  // Check for standard experience fields first
  if (job.experience) return job.experience;
  if (job.exp_required) return job.exp_required;
  if (job.expRequired) return job.expRequired;

  // If min and max experience are available
  if (job.min_experience && job.max_experience) {
    return `${job.min_experience} - ${job.max_experience} years`;
  } else if (job.min_exp !== undefined && job.max_exp !== undefined) {
    return `${job.min_exp} - ${job.max_exp} Years of experience`;
  } else if (job.min_experience) {
    return `${job.min_experience}+ years`;
  }

  // Try to extract experience from the description
  if (description) {
    // Look for common experience patterns in the description
    const expPatterns = [
      /experience required:?\s*([^.]+)/i,
      /(\d+[-\s]?\d*\s*(?:years|yrs)(?:\s*of)?\s*(?:experience|exp))/i,
      /(\d+\+\s*(?:years|yrs)(?:\s*of)?\s*(?:experience|exp))/i,
      /minimum\s*(\d+[-\s]?\d*\s*(?:years|yrs)(?:\s*of)?\s*(?:experience|exp))/i,
      /need min\s*(\d+[-\s]?\d*\s*yrs[^.]+)/i,
    ];

    for (const pattern of expPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  // If we can't find experience information, check if there's a specific mention in the HTML
  if (job.public_job_desc) {
    const expPatterns = [
      /<div>Experience required:?\s*([^<]+)<\/div>/i,
      /<li>Minimum\s*(\d+[-\s]?\d*\s*(?:years|yrs)(?:\s*of)?\s*(?:experience|exp)[^<]+)<\/li>/i,
      /<div>Need Min\s*(\d+[-\s]?\d*\s*yrs[^<]+)<\/div>/i,
    ];

    for (const pattern of expPatterns) {
      const match = job.public_job_desc.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  return "Experience not specified";
}

// Helper function to extract responsibilities
function extractResponsibilities(job) {
  if (Array.isArray(job.responsibilities)) return job.responsibilities;
  if (Array.isArray(job.job_responsibilities)) return job.job_responsibilities;
  if (Array.isArray(job.jobResponsibilities)) return job.jobResponsibilities;

  // If responsibilities are in a string format, try to split them
  if (typeof job.responsibilities === "string") {
    return job.responsibilities
      .split(/\n|•/)
      .filter((item) => item.trim().length > 0);
  }

  if (typeof job.job_description === "string") {
    // Try to extract responsibilities section from job description
    const descLines = job.job_description.split("\n");
    const respIndex = descLines.findIndex(
      (line) =>
        line.toLowerCase().includes("responsibilities") ||
        line.toLowerCase().includes("duties")
    );

    if (respIndex >= 0) {
      return descLines
        .slice(respIndex + 1)
        .filter((line) => line.trim().length > 0)
        .map((line) => line.replace(/^[-•*]\s*/, "").trim());
    }
  }

  return [];
}

// app.post("/api/apply-job", upload.single("resume"), async (req, res) => {
//   try {
//     const { jobId, firstName, lastName, email, phone } = req.body;
//     const resumeFile = req.file;

//     if (!jobId || !firstName || !lastName || !email || !phone || !resumeFile) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields",
//       });
//     }

//     const formData = new FormData();
//     formData.append("job_id", jobId);
//     formData.append("first_name", firstName);
//     formData.append("last_name", lastName);
//     formData.append("email", email);
//     formData.append("phone", phone);

//     const fileStream = fs.createReadStream(resumeFile.path);
//     formData.append("resume", fileStream, {
//       filename: resumeFile.originalname,
//       contentType: resumeFile.mimetype,
//     });

//     const apiToken = process.env.CEIPAL_API_TOKEN;
//     if (!apiToken) {
//       return res.status(500).json({
//         success: false,
//         message: "API token not configured",
//       });
//     }

//     const response = await fetch(
//       "https://api.ceipal.com/v1/applyJobWithOutRegistration",
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${apiToken}`,
//         },
//         body: formData,
//       }
//     );

//     const responseData = await response.json();

//     fs.unlinkSync(resumeFile.path);

//     return res.json({
//       success: response.ok,
//       data: responseData,
//     });
//   } catch (error) {
//     console.error("Error applying for job:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to submit application",
//       error: error.message,
//     });
//   }
// });

// Start the server

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Get all jobs at http://localhost:${PORT}/api/jobs`);
});
