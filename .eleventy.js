const exifr = require('exifr');
const path = require('path');
const fs = require('fs');
const { DateTime } = require('luxon');

module.exports = function(eleventyConfig) {
  // Passthrough copy for static assets
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "exif-fixer": "exif-fixer" });

  // Date formatting filter
  eleventyConfig.addFilter("formatDate", (dateObj, format = "LLLL d, yyyy") => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: 'utc' }).toFormat(format);
  });

  // Custom collection for photos with EXIF + frontmatter override processing
  eleventyConfig.addCollection("photos", async function(collectionApi) {
    const photos = collectionApi.getFilteredByTag("photos");

    for (let item of photos) {
      const photoRelPath = item.data.photo;
      let rawExif = {};

      if (photoRelPath) {
        const fullPath = path.join(__dirname, 'src', photoRelPath.replace(/^\//, ''));
        if (fs.existsSync(fullPath)) {
          try {
            rawExif = (await exifr.parse(fullPath)) || {};
          } catch (e) {
            console.error("EXIF Error for", fullPath, e);
          }
        }
      }

      // Prioritize frontmatter overrides
      const make = item.data.camera_make || item.data.make || rawExif.Make || null;
      const model = item.data.camera_model || item.data.model || rawExif.Model || null;
      const film = item.data.film || null;
      const iso = item.data.iso || rawExif.ISO || (rawExif.ISOSpeedRatings ? rawExif.ISOSpeedRatings[0] : null) || null;
      const lens = item.data.lens || rawExif.LensModel || null;
      const focalLength = rawExif.FocalLength ? `${rawExif.FocalLength}mm` : null;

      let aperture = null;
      if (rawExif.FNumber) {
        aperture = `f/${rawExif.FNumber}`;
      }

      let shutterSpeed = null;
      if (rawExif.ExposureTime) {
        if (rawExif.ExposureTime < 1) {
          shutterSpeed = `1/${Math.round(1 / rawExif.ExposureTime)}s`;
        } else {
          shutterSpeed = `${rawExif.ExposureTime}s`;
        }
      }

      let dateTaken = item.data.date ? DateTime.fromJSDate(new Date(item.data.date)).toFormat("LLLL yyyy") : null;
      if (!dateTaken && rawExif.DateTimeOriginal) {
        dateTaken = DateTime.fromJSDate(new Date(rawExif.DateTimeOriginal)).toFormat("LLLL d, yyyy");
      }

      item.data.exifData = {
        make,
        model,
        film,
        iso,
        lens,
        focalLength,
        aperture,
        shutterSpeed,
        dateTaken,
        overrides: {
          make: !!(item.data.camera_make || item.data.make),
          model: !!(item.data.camera_model || item.data.model),
          film: !!item.data.film,
          iso: !!item.data.iso
        }
      };
    }

    return photos;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
