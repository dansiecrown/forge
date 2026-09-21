// Populates a complete, realistic "Tech Impact Fellowship — Cohort 1"
// student learning experience: 3 Learning Tracks (Web Development, WordPress
// Website Design, Graphics Design), each with 1 Course, 3 Weekly Modules,
// real lessons/resources/practical tasks, a dedicated test student account,
// and an active Enrollment in each track's Cohort offering. Rebuilds the
// Cohort's `curriculumSnapshot` at the end (mirrors
// CurriculumSnapshotService.build() — see that file's own doc comment for
// why the snapshot, not the live catalog, is what students actually read;
// docs/adr/0006-curriculum-learning-engine.md Decision 1).
//
// Idempotent (find-or-create / upsert throughout — see each helper's own
// comment for its exact idempotency key), consistent with the direct-Prisma-
// write convention already established by identity.seed.ts and
// dev-test-users.seed.ts. Safe to re-run; re-running only updates content
// in place, never duplicates it.
//
// Run directly (not part of `prisma:seed`, matching dev-test-users.seed.ts's
// own "local-dev fixture, not CI/deploy" precedent):
//   pnpm --filter @forge/api exec ts-node --transpile-only prisma/seeds/tech-impact-cohort1.seed.ts
// or, from apps/api:
//   pnpm seed:cohort1
import { join } from 'node:path';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import {
  PrismaClient,
  type CurriculumStatus,
  type LessonType,
  type LearningResourceType,
  type TrackDifficulty,
} from '@prisma/client';

loadEnv({ path: join(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

const PUBLISHED: CurriculumStatus = 'published';
const TEST_STUDENT_PASSWORD = 'TestPass123!';

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

interface LessonSeed {
  title: string;
  description: string;
  lessonType: LessonType;
  estimatedDurationMinutes: number;
  resourceUrl?: string;
  completionRequired?: boolean;
}

interface ResourceSeed {
  title: string;
  resourceType: LearningResourceType;
  url: string;
  author?: string;
  provider?: string;
  estimatedDurationMinutes?: number;
  isRequired?: boolean;
  notes?: string;
}

interface TaskSeed {
  title: string;
  description: string;
  instructions: string;
  deliverables: string[];
  dueOffsetDays: number;
  maxScore: number;
  rubric?: Record<string, string>;
}

interface WeekSeed {
  weekNumber: number;
  title: string;
  objectives: string[];
  summary: string;
  estimatedStudyHours: number;
  lessons: LessonSeed[];
  resources: ResourceSeed[];
  tasks: TaskSeed[];
}

interface TrackSeed {
  name: string;
  slug: string;
  description: string;
  difficulty: TrackDifficulty;
  estimatedWeeks: number;
  learningOutcomes: string[];
  tags: string[];
  courseTitle: string;
  courseSlug: string;
  courseOverview: string;
  courseObjectives: string[];
  completionCriteria: string;
  estimatedHours: number;
  weeks: WeekSeed[];
}

// ---------------------------------------------------------------------------
// Web Development
// ---------------------------------------------------------------------------

const WEB_DEVELOPMENT: TrackSeed = {
  name: 'Web Development',
  slug: 'web-development',
  description:
    'Learn to build real web pages from scratch: structure with HTML, style with CSS, and add interactivity with JavaScript. By the end of the track you will have built a small, working personal website.',
  difficulty: 'beginner',
  estimatedWeeks: 3,
  learningOutcomes: [
    'Write semantic, well-structured HTML documents',
    'Style responsive layouts with modern CSS, including Flexbox',
    'Use JavaScript to read and react to what a user does on a page',
    'Ship a small, multi-section personal website',
  ],
  tags: ['html', 'css', 'javascript', 'frontend'],
  courseTitle: 'Web Development Fundamentals',
  courseSlug: 'web-development-fundamentals',
  courseOverview:
    'A hands-on introduction to the three languages every website is built from: HTML, CSS, and JavaScript. Each week ends with a practical exercise that builds toward one finished mini website.',
  courseObjectives: [
    'Understand how a browser turns HTML/CSS/JS into a page',
    'Build and style a multi-section page without a framework',
    'Add basic interactivity with vanilla JavaScript',
  ],
  completionCriteria:
    'Complete all required lessons and resources in each week, and submit all three weekly assignments.',
  estimatedHours: 24,
  weeks: [
    {
      weekNumber: 1,
      title: 'HTML Fundamentals',
      objectives: [
        'Explain how a web page request/response works',
        'Write a valid HTML document with the correct structure',
        'Use semantic tags, headings, links, images, lists, and basic form inputs correctly',
      ],
      summary:
        'How the web works, and how to structure a page with HTML — the skeleton every website is built on.',
      estimatedStudyHours: 8,
      lessons: [
        {
          title: 'How Websites Work',
          lessonType: 'reading',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'Before writing any code, it helps to know what actually happens when someone visits a website.\n\nWhen you type a URL and press Enter:\n- Your browser looks up the address of the server that hosts the site (DNS).\n- It sends a request to that server asking for a page.\n- The server sends back files — usually an HTML file, plus CSS and JavaScript files it references.\n- Your browser reads the HTML top to bottom, builds a structure from it (the DOM), applies the CSS, and runs the JavaScript.\n\nHTML describes the content and structure of a page (headings, paragraphs, images, forms). CSS describes how it should look (colors, spacing, layout). JavaScript describes how it should behave (what happens when you click something, type something, or scroll).\n\nYou will work with all three this track, one at a time: HTML this week, CSS next week, JavaScript in week three. Every real website — no matter how complex — is still built from these same three layers underneath.',
        },
        {
          title: 'Document Structure and Your First Page',
          lessonType: 'article',
          estimatedDurationMinutes: 25,
          completionRequired: true,
          description:
            'Every HTML document follows the same basic skeleton:\n\n<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <title>Page Title</title>\n  </head>\n  <body>\n    <!-- visible content goes here -->\n  </body>\n</html>\n\n- <!DOCTYPE html> tells the browser this is a modern HTML document.\n- <html> wraps the whole page.\n- <head> holds information ABOUT the page (title, character encoding, links to CSS) — nothing in <head> is directly visible.\n- <body> holds everything the visitor actually sees.\n\nTags almost always come in opening/closing pairs, like <p>text</p>. A few tags are "self-closing" because they have no content inside them, like <img> and <br>.\n\nTask for this lesson: create a file called index.html on your computer, copy the skeleton above, add a <h1> with your name inside the body, save it, and open it in your browser by double-clicking the file. That is a complete, real website — just not published yet.',
        },
        {
          title: 'Semantic HTML: Headings, Paragraphs, and Structure Tags',
          lessonType: 'article',
          estimatedDurationMinutes: 30,
          completionRequired: true,
          description:
            '"Semantic" HTML means choosing tags based on what the content IS, not just how you want it to look. This matters for accessibility (screen readers rely on it) and for search engines.\n\nHeadings: <h1> through <h6>, in order of importance. Use exactly one <h1> per page (the main title), then <h2> for major sections, <h3> for subsections.\n\nParagraphs: <p> for any block of running text.\n\nStructural sections: <header> (top of a page or section), <nav> (navigation links), <main> (the primary content — one per page), <section> (a thematic grouping), <article> (a self-contained piece of content), <footer> (bottom of a page or section).\n\nAvoid using a heading just to make text look big and bold — that is what CSS is for (next week). Use headings to describe the actual outline of your page, the way you would outline an essay.',
        },
        {
          title: 'Links, Images, and Lists',
          lessonType: 'article',
          estimatedDurationMinutes: 25,
          completionRequired: true,
          description:
            'Links: <a href="https://example.com">visit example</a>. The href attribute is the destination. Use target="_blank" to open in a new tab.\n\nImages: <img src="photo.jpg" alt="A description of the photo">. The alt attribute is not optional — it is what a screen reader announces, and what shows if the image fails to load. Always describe what is actually in the image.\n\nUnordered lists (bullets): <ul><li>item</li></ul>\nOrdered lists (numbered): <ol><li>item</li></ol>\n\nAttributes always live inside the opening tag, as name="value" pairs. You can combine several on one element, e.g. <a href="page.html" target="_blank">link text</a>.',
        },
        {
          title: 'Forms and Basic Inputs',
          lessonType: 'video',
          estimatedDurationMinutes: 45,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/916GWv2Qs08',
          description:
            'Forms are how a page collects information from a visitor — a contact form, a search box, a signup page.\n\n<form>\n  <label for="name">Name</label>\n  <input type="text" id="name" name="name">\n\n  <label for="email">Email</label>\n  <input type="email" id="email" name="email">\n\n  <button type="submit">Send</button>\n</form>\n\n- <label> connects a piece of text to an input via a matching for/id pair — this is another accessibility essential, not decoration.\n- Common input types: text, email, password, number, checkbox, radio.\n- <button type="submit"> submits the form.\n\nThis crash-course video walks through the exact same fundamentals covered this week (structure, semantic tags, links, images, lists, and forms) in one connected walkthrough — useful as a recap before you build the practice page.',
        },
      ],
      resources: [
        {
          title: 'MDN — HTML basics',
          resourceType: 'official_documentation',
          url: 'https://developer.mozilla.org/en-US/docs/Web/HTML',
          provider: 'MDN Web Docs',
          isRequired: true,
          notes:
            'The authoritative reference for every HTML element. Bookmark this — you will come back to it constantly.',
        },
        {
          title: 'W3Schools — HTML Tutorial',
          resourceType: 'article',
          url: 'https://www.w3schools.com/html/',
          provider: 'W3Schools',
          isRequired: false,
          notes:
            'A more example-driven, beginner-paced alternative to MDN, with a "try it yourself" editor for every tag.',
        },
        {
          title: 'HTML Tutorial - Website Crash Course for Beginners',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=916GWv2Qs08',
          provider: 'YouTube',
          estimatedDurationMinutes: 45,
          isRequired: true,
          notes:
            'Same video embedded in the "Forms and Basic Inputs" lesson — listed here too so it is easy to find again from the resources list.',
        },
        {
          title: 'HTML Validator',
          resourceType: 'other',
          url: 'https://validator.w3.org/',
          provider: 'W3C',
          isRequired: false,
          notes:
            'Paste your HTML here to catch structural mistakes before you move on to styling it.',
        },
      ],
      tasks: [
        {
          title: 'Practice: Structure a Recipe Page',
          description:
            "A short, low-stakes exercise to practice this week's tags before the graded assignment.",
          instructions:
            'Create a new file, recipe.html. Using only the tags covered this week, structure a page for your favourite recipe:\n- One <h1> with the recipe name\n- A short <p> introducing it\n- An <img> of the dish (any placeholder image URL is fine) with a real alt description\n- An <ol> for the steps\n- A <ul> for the ingredients\n\nNo CSS yet — the goal is clean, correct structure.',
          deliverables: ['A working recipe.html file, opened and checked in your own browser'],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Build Your First Semantic Web Page',
          description:
            "This week's graded assignment: a simple personal profile page using proper semantic structure — the foundation you will style next week and add interactivity to in week 3.",
          instructions:
            'Create index.html for a personal profile page. It must include, in this order:\n1. A <header> containing an <h1> with your name and a short tagline in a <p>\n2. A <nav> with at least 3 links (they can point to "#" placeholders for now)\n3. A <main> containing:\n   - An <img> of yourself or an avatar, with a meaningful alt\n   - A <section> "About Me" with 2-3 paragraphs\n   - A <section> "Things I Want to Learn" as a <ul>\n4. A <footer> with a copyright line and a mailto: link\n\nSubmit by sharing a working link (see submission requirements below).',
          deliverables: [
            'A single, valid index.html file covering every required section',
            'A shareable link to the working page',
          ],
          dueOffsetDays: 6,
          maxScore: 100,
          rubric: {
            structure: 'Uses the correct semantic tags (header/nav/main/section/footer) — 40 pts',
            content: 'All required content sections are present and meaningful — 30 pts',
            accessibility: 'Every image has a real, descriptive alt attribute — 20 pts',
            validity: 'Page has no structural HTML errors — 10 pts',
          },
        },
      ],
    },
    {
      weekNumber: 2,
      title: 'CSS Fundamentals',
      objectives: [
        'Apply CSS using selectors, the box model, and typography properties',
        'Explain and use the box model to control spacing',
        'Build a responsive section layout with Flexbox',
      ],
      summary: "Turn last week's bare HTML into something that actually looks like a website.",
      estimatedStudyHours: 8,
      lessons: [
        {
          title: 'CSS Selectors and How Styles Are Applied',
          lessonType: 'video',
          estimatedDurationMinutes: 40,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/yfoY53QXEnI',
          description:
            'CSS rules follow the pattern: selector { property: value; }\n\nh1 { color: navy; }\n\nCommon selectors:\n- Element: p { }  — every <p>\n- Class: .card { }  — every element with class="card"\n- ID: #main-title { }  — the one element with id="main-title"\n- Descendant: nav a { }  — every <a> inside a <nav>\n\nClasses are reusable and are what you will use most. IDs are for one-off, unique elements (and are used by JavaScript later, and by page-internal links).\n\nThree ways to attach CSS to HTML: an external file linked with <link rel="stylesheet" href="styles.css"> in <head> (the standard approach — use this one), a <style> block in <head>, or an inline style="" attribute (avoid this — it does not scale).\n\nThis crash course covers exactly these fundamentals — selectors, the box model, and basic layout — in one sitting.',
        },
        {
          title: 'The Box Model',
          lessonType: 'article',
          estimatedDurationMinutes: 25,
          completionRequired: true,
          description:
            'Every element on a page is a rectangular box made of four layers, from the inside out:\n\ncontent → padding → border → margin\n\n- content: the text or image itself, sized by width/height\n- padding: space INSIDE the border, between content and border\n- border: a visible (or invisible) line around the padding\n- margin: space OUTSIDE the border, pushing other elements away\n\n.card {\n  width: 300px;\n  padding: 16px;\n  border: 1px solid #ddd;\n  margin: 12px;\n}\n\nBy default, width/height set only the CONTENT size — padding and border are added on top, which trips up almost every beginner. Fix it once, globally:\n\n* { box-sizing: border-box; }\n\nWith border-box, width/height include padding and border, so the box is exactly the size you set. Add this rule at the top of every CSS file you write from now on.',
        },
        {
          title: 'Typography and Color',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'Typography properties:\n- font-family: "Segoe UI", Arial, sans-serif;  (list fallbacks — the browser uses the first one it has)\n- font-size: 16px;  (16px is a sensible body-text default)\n- font-weight: 400 | 700 | bold | normal;\n- line-height: 1.5;  (space between lines — 1.4–1.6 is comfortable for reading)\n- text-align: left | center | right;\n\nColor:\n- color: sets TEXT color\n- background-color: sets the box\'s background\n- Colors can be named (red), hex (#1a1a1a), or rgb(26, 26, 26)\n\nA quick rule of thumb for a beginner palette: pick one dark neutral for text, one light neutral for backgrounds, and one accent color used sparingly (links, buttons). Google Fonts is a good source of free, well-paired fonts if you want to go beyond system fonts.',
        },
        {
          title: 'Flexbox Layout',
          lessonType: 'video',
          estimatedDurationMinutes: 35,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/kbmEl0oScNc',
          description:
            "Flexbox is how you arrange a row or column of boxes without fighting with floats. Put display: flex on a PARENT element, and its direct children automatically line up.\n\n.nav-links {\n  display: flex;\n  gap: 16px;\n  justify-content: space-between;\n  align-items: center;\n}\n\n- display: flex — turns on flex layout for the children\n- flex-direction: row (default) or column\n- justify-content — spacing along the main axis: flex-start, center, space-between, space-around\n- align-items — alignment along the cross axis: flex-start, center, stretch\n- gap — space between children, no margin hacks needed\n\nFlexbox is the single most useful CSS tool for a beginner: navigation bars, card rows, centering something on a page (display:flex; justify-content:center; align-items:center; on the parent solves 'how do I center a div' for good).",
        },
        {
          title: 'Responsive Basics',
          lessonType: 'reading',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'A "responsive" page adapts to different screen sizes instead of breaking on a phone.\n\nTwo essentials:\n1. The viewport meta tag — without it, mobile browsers zoom out and render your page as if it were a desktop page. Always include this in <head>:\n   <meta name="viewport" content="width=device-width, initial-scale=1.0">\n\n2. Media queries — apply different CSS below a certain width:\n   @media (max-width: 600px) {\n     .nav-links { flex-direction: column; }\n   }\n\nA practical mobile-first habit: write your normal styles for mobile first (single column, stacked), then use a media query for LARGER screens to switch a flex row from column to row, or widen a container. This week\'s task only asks for one breakpoint — do not over-engineer it yet.',
        },
      ],
      resources: [
        {
          title: 'MDN — CSS basics',
          resourceType: 'official_documentation',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
          provider: 'MDN Web Docs',
          isRequired: true,
        },
        {
          title: 'CSS Crash Course For Absolute Beginners',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=yfoY53QXEnI',
          author: 'Traversy Media',
          provider: 'YouTube',
          estimatedDurationMinutes: 40,
          isRequired: true,
        },
        {
          title: 'Learning Flexbox CSS In 2022 (Crash Course)',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=kbmEl0oScNc',
          provider: 'YouTube',
          estimatedDurationMinutes: 35,
          isRequired: true,
        },
        {
          title: 'Flexbox Froggy (interactive practice game)',
          resourceType: 'other',
          url: 'https://flexboxfroggy.com/',
          isRequired: false,
          notes:
            'A free game that teaches Flexbox properties by moving frogs onto lily pads. Genuinely useful, 10-15 minutes.',
        },
        {
          title: 'Google Fonts',
          resourceType: 'other',
          url: 'https://fonts.google.com/',
          isRequired: false,
          notes: 'Free web fonts you can add to your page with one <link> tag.',
        },
      ],
      tasks: [
        {
          title: 'Practice: Style the Recipe Page',
          description: "Apply this week's CSS to last week's recipe.html practice file.",
          instructions:
            'Create recipe.css and link it to recipe.html. Style it so that: the page has a readable font and line-height, the image has a fixed width with rounded corners, and the ingredients list sits beside the image using Flexbox on wider screens.',
          deliverables: ['recipe.html + recipe.css, linked and working'],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Style a Responsive Landing Page',
          description:
            'Take the semantic profile page from Week 1 and turn it into a properly styled, responsive landing page.',
          instructions:
            'Create styles.css and link it to your Week 1 index.html. Requirements:\n1. Add * { box-sizing: border-box; } and a consistent font/line-height for the whole page\n2. Style the <header> with a background color and center its content\n3. Use display: flex on the <nav> so its links sit in a row with even spacing\n4. Give each <section> in <main> padding and a max-width so text does not stretch edge-to-edge\n5. Add one @media (max-width: 600px) rule that stacks the nav links vertically on small screens\n\nDo not change the HTML structure from Week 1 — this assignment is purely about styling it.',
          deliverables: [
            'styles.css linked to your Week 1 index.html',
            'A shareable link to the styled, working page',
          ],
          dueOffsetDays: 6,
          maxScore: 100,
          rubric: {
            boxModel: 'box-sizing: border-box applied globally; consistent spacing — 20 pts',
            typography: 'Readable font, size, and line-height throughout — 20 pts',
            flexbox: 'Navigation correctly laid out with Flexbox — 30 pts',
            responsive: 'At least one working media query that visibly changes the layout — 30 pts',
          },
        },
      ],
    },
    {
      weekNumber: 3,
      title: 'JavaScript Fundamentals',
      objectives: [
        'Use variables, data types, and functions to store and transform data',
        'Use conditionals and simple arrays/objects',
        'Select DOM elements and respond to click events',
      ],
      summary: 'Make your page do something when a visitor interacts with it.',
      estimatedStudyHours: 8,
      lessons: [
        {
          title: 'Variables, Data Types, and Functions',
          lessonType: 'video',
          estimatedDurationMinutes: 50,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/hdI2bqOjy3c',
          description:
            "JavaScript is the layer that makes a page interactive. Three ways to declare a variable:\n\nlet name = 'Ada';       // can be reassigned\nconst maxScore = 100;    // cannot be reassigned — prefer this by default\nvar oldStyle = 'avoid';  // legacy, avoid in new code\n\nBasic data types: string ('text'), number (42, 3.14), boolean (true/false), array ([1,2,3]), object ({key: 'value'}).\n\nFunctions package up reusable logic:\n\nfunction greet(name) {\n  return 'Hello, ' + name + '!';\n}\ngreet('Ada'); // 'Hello, Ada!'\n\n// arrow function, shorter syntax for the same thing:\nconst greet2 = (name) => 'Hello, ' + name + '!';\n\nThis crash course covers exactly these fundamentals from scratch, at a beginner pace.",
        },
        {
          title: 'Conditionals, Arrays, and Objects',
          lessonType: 'article',
          estimatedDurationMinutes: 30,
          completionRequired: true,
          description:
            "Conditionals let code make decisions:\n\nif (score >= 50) {\n  console.log('Pass');\n} else {\n  console.log('Try again');\n}\n\nComparison operators: === (equal, use this not ==), !== (not equal), >, <, >=, <=.\nLogical operators: && (and), || (or), ! (not).\n\nArrays hold ordered lists of values:\nconst colors = ['red', 'green', 'blue'];\ncolors[0];        // 'red'\ncolors.length;    // 3\ncolors.push('yellow'); // adds to the end\n\nObjects hold named key/value pairs:\nconst student = { name: 'Ada', track: 'Web Development' };\nstudent.name;      // 'Ada'\nstudent['track'];  // 'Web Development'\n\nYou will use exactly this combination — an if statement checking a value, and an array or object holding data — in almost every small script you write.",
        },
        {
          title: 'The DOM: Selecting and Changing Elements',
          lessonType: 'video',
          estimatedDurationMinutes: 40,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/5fb2aPlgoys',
          description:
            "The DOM (Document Object Model) is the browser's live, in-memory version of your HTML — JavaScript reads and changes THIS, and the page updates instantly.\n\nSelecting elements:\nconst title = document.querySelector('h1');\nconst allCards = document.querySelectorAll('.card'); // returns a list\n\nChanging what they show or how they look:\ntitle.textContent = 'New Title';\ntitle.style.color = 'blue';\ntitle.classList.add('highlight');\ntitle.classList.remove('highlight');\n\nquerySelector accepts any CSS selector you already know from last week — '.class', '#id', 'tag' — which is why learning CSS selectors first pays off immediately here.",
        },
        {
          title: 'Events: Making Things Happen on Click',
          lessonType: 'article',
          estimatedDurationMinutes: 25,
          completionRequired: true,
          description:
            "An event listener runs a function whenever something happens — a click, a key press, a form submit.\n\nconst button = document.querySelector('#toggle-btn');\nbutton.addEventListener('click', () => {\n  const panel = document.querySelector('#panel');\n  panel.classList.toggle('open');\n});\n\nclassList.toggle() is especially useful — it adds a class if the element doesn't have it, and removes it if it does. This is exactly how a 'show more / hide' button, a mobile menu toggle, or a dark-mode switch works: a click event listener that toggles a CSS class, and CSS rules that define what that class looks like.\n\nOther common events: 'submit' (on a <form>), 'input' (as someone types), 'mouseover' (hovering).",
        },
        {
          title: 'Building a Simple Interactive Page',
          lessonType: 'reading',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            "Putting it together: a typical small interactive feature follows this exact pattern every time.\n\n1. Select the element(s) you need with querySelector\n2. Add an event listener for the interaction (click, submit, input)\n3. Inside the listener, read or change something (textContent, classList, an array of data)\n\nExample: a simple counter button.\n\n<button id=\"counter\">Clicked 0 times</button>\n\n<script>\n  let count = 0;\n  const btn = document.querySelector('#counter');\n  btn.addEventListener('click', () => {\n    count = count + 1;\n    btn.textContent = `Clicked ${count} times`;\n  });\n</script>\n\nNotice the variable (count) lives OUTSIDE the listener, so it persists between clicks, while the DOM update happens INSIDE the listener, every time it runs. This is the shape of almost every small interactive script you will write as a beginner.",
        },
      ],
      resources: [
        {
          title: 'MDN — JavaScript basics',
          resourceType: 'official_documentation',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
          provider: 'MDN Web Docs',
          isRequired: true,
        },
        {
          title: 'JavaScript Crash Course For Beginners',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=hdI2bqOjy3c',
          author: 'Traversy Media',
          provider: 'YouTube',
          estimatedDurationMinutes: 50,
          isRequired: true,
        },
        {
          title: 'JavaScript DOM Manipulation – Full Course for Beginners',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=5fb2aPlgoys',
          provider: 'YouTube (freeCodeCamp)',
          estimatedDurationMinutes: 40,
          isRequired: true,
        },
        {
          title: 'W3Schools — JavaScript Tutorial',
          resourceType: 'article',
          url: 'https://www.w3schools.com/js/',
          provider: 'W3Schools',
          isRequired: false,
        },
      ],
      tasks: [
        {
          title: 'Practice: Click Counter',
          description:
            'A small, self-contained script to practice events and the DOM before the final project.',
          instructions:
            "On any HTML page, add a button and a paragraph. Write JavaScript so each click increases a counter and updates the paragraph text to show the current count, exactly like the example in this week's last lesson.",
          deliverables: ['A single HTML file with the working counter'],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Build an Interactive Mini Website',
          description:
            'The capstone for the Web Development track: bring HTML structure, CSS styling, and JavaScript interactivity together into one finished mini website.',
          instructions:
            'Extend your Week 1/2 profile page with at least one real interactive feature. Choose at least ONE of the following (or combine several):\n- A "show more" button that reveals an extra paragraph of text using classList.toggle\n- A simple contact form that, on submit, prevents the page reload (event.preventDefault()) and shows a "Thanks, I\'ll be in touch!" message instead\n- A mobile navigation menu button that toggles the nav links open/closed on small screens\n\nYour final submission should be the SAME page you have been building since Week 1, now complete with structure, styling, and at least one working interactive feature.',
          deliverables: [
            'Your complete, working mini website (HTML + CSS + JS)',
            'A shareable link to the final version',
          ],
          dueOffsetDays: 7,
          maxScore: 100,
          rubric: {
            functionality:
              'The interactive feature works correctly when clicked/submitted — 40 pts',
            codeQuality:
              'JavaScript uses variables, a function, and an event listener sensibly — 25 pts',
            integration: 'Builds cleanly on the Week 1/2 HTML and CSS without breaking it — 25 pts',
            polish: 'No console errors; page looks intentional, not broken — 10 pts',
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// WordPress Website Design
// ---------------------------------------------------------------------------

const WORDPRESS: TrackSeed = {
  name: 'WordPress Website Design',
  slug: 'wordpress-website-design',
  description:
    'Learn to plan, build, and launch a real small-business website using WordPress — no coding required. By the end of the track you will have published a complete multi-page business site.',
  difficulty: 'beginner',
  estimatedWeeks: 3,
  learningOutcomes: [
    'Explain what WordPress is and set up a WordPress site',
    "Customize a theme's identity, colors, typography, and navigation",
    'Install and configure essential plugins, including a contact form',
    'Plan and build a complete small-business website',
  ],
  tags: ['wordpress', 'website-design', 'no-code'],
  courseTitle: 'WordPress Website Design',
  courseSlug: 'wordpress-website-design-course',
  courseOverview:
    'A practical, build-as-you-learn course: by Week 3 you will have planned, structured, styled, and published a complete small-business website in WordPress.',
  courseObjectives: [
    'Understand the WordPress dashboard, themes, pages, and posts',
    'Customize a theme to match a simple brand',
    'Configure essential plugins and a working contact form',
    'Plan and publish a complete small-business website',
  ],
  completionCriteria:
    'Complete all required lessons and resources in each week, and submit all three weekly assignments.',
  estimatedHours: 22,
  weeks: [
    {
      weekNumber: 1,
      title: 'WordPress Foundations',
      objectives: [
        'Explain the difference between WordPress.com and WordPress.org',
        'Navigate the WordPress dashboard confidently',
        'Understand Pages vs Posts, and set up navigation menus',
      ],
      summary: 'What WordPress actually is, and how to get a basic site structure in place.',
      estimatedStudyHours: 7,
      lessons: [
        {
          title: 'What WordPress Is, and WordPress.com vs WordPress.org',
          lessonType: 'reading',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'WordPress is software that runs a website: it stores your content in a database and lets you edit pages through a visual dashboard instead of writing code by hand. It powers a large share of all websites on the internet — from personal blogs to large business sites.\n\nThere are two very different things both called "WordPress":\n\n- WordPress.com: a hosted service. They run the servers for you. Easiest to start, but the free plan is limited (no custom plugins, WordPress branding, limited customization).\n\n- WordPress.org: the free, open-source SOFTWARE itself, which you install on hosting you choose. Full control — any theme, any plugin — but you are responsible for choosing a host and basic maintenance.\n\nMost real small-business sites use WordPress.org with a hosting provider. This is what this track focuses on. If you don\'t have hosting yet, many hosts offer a free trial or a very low-cost starter plan that is enough for this course.',
        },
        {
          title: 'Domains and Hosting, in Plain Terms',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'Two separate things you need for a real website:\n\n- A domain name (e.g. yourbusiness.com) — the address people type. You rent this yearly from a registrar.\n- Hosting — the computer that actually stores your website files and serves them when someone visits. Many hosts offer "one-click WordPress install" which sets it up for you automatically.\n\nFor this course, you can practice in one of two ways:\n1. A real (even free-tier) hosting account with WordPress installed, or\n2. A local development tool that runs WordPress on your own computer for practice, without needing hosting yet.\n\nEither is fine for completing the weekly tasks. What matters is that you get comfortable in the actual WordPress dashboard.',
        },
        {
          title: 'The WordPress Dashboard',
          lessonType: 'video',
          estimatedDurationMinutes: 40,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/O79pJ7qXwoE',
          description:
            'Once WordPress is installed, you manage everything from /wp-admin. The dashboard sidebar you will use constantly:\n\n- Posts — blog-style, date-ordered content\n- Pages — standalone content like "About" or "Contact" that is not date-ordered\n- Media — every image/file you have uploaded (the Media Library)\n- Appearance → Themes — controls your site\'s overall design\n- Appearance → Menus — controls navigation links\n- Plugins — add-on functionality (forms, SEO, security, etc.)\n- Settings → General — site title, tagline, timezone\n\nThis full walkthrough video covers exactly this — setting up a site, exploring the dashboard, choosing a theme, and creating your first pages — start to finish.',
        },
        {
          title: 'Pages vs Posts, and Basic Site Structure',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            "The single most common beginner confusion in WordPress: Pages vs Posts.\n\n- Pages are for STATIC, standalone content that rarely changes: Home, About, Services, Contact. A business site is built almost entirely out of Pages.\n- Posts are for content published over TIME, newest first: blog articles, news, updates. A business site may or may not need a blog at all.\n\nA typical small-business site structure:\n- Home\n- About\n- Services (or Products)\n- Contact\n\nEach of these is one Page. Create them under Pages → Add New. Don't worry about making them look good yet — this week is about getting the right pages to exist with basic content in them; styling comes next week.",
        },
        {
          title: 'Menus and the Media Library',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'Once your pages exist, visitors need a way to find them: Appearance → Menus.\n\n1. Create a new menu, give it a name like "Main Menu"\n2. Add your Pages to it from the left panel (check the boxes, click "Add to Menu")\n3. Drag to reorder\n4. Assign it to your theme\'s "Primary" menu location\n5. Save\n\nMedia Library (Media → Library): every image you upload anywhere on the site lives here and can be reused. Upload a logo and a homepage image now, sized reasonably (under 1MB each) so your site loads quickly — this is a common beginner mistake that makes sites slow.',
        },
      ],
      resources: [
        {
          title: 'WordPress.org — Official Documentation',
          resourceType: 'official_documentation',
          url: 'https://wordpress.org/documentation/',
          provider: 'WordPress.org',
          isRequired: true,
        },
        {
          title: 'How To Make a Website With WordPress (Beginners Tutorial)',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=O79pJ7qXwoE',
          provider: 'YouTube',
          estimatedDurationMinutes: 40,
          isRequired: true,
        },
        {
          title: 'WordPress Block Editor Guide',
          resourceType: 'official_documentation',
          url: 'https://wordpress.org/documentation/article/wordpress-block-editor/',
          provider: 'WordPress.org',
          isRequired: false,
          notes:
            'How the page/post editor ("Gutenberg") actually works — worth skimming before you start building pages.',
        },
      ],
      tasks: [
        {
          title: 'Practice: Explore the Dashboard',
          description: 'Get comfortable navigating before building anything real.',
          instructions:
            'In your WordPress dashboard: create one test Page and one test Post, upload one image to the Media Library, and create a menu with at least 2 items (they can be placeholder pages).',
          deliverables: [
            "A short written note (2-3 sentences) on what you found, in your submission link's notes",
          ],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Plan and Structure a Business Website',
          description:
            "This week's graded assignment: choose a simple, realistic business (real or invented — a bakery, a tutoring service, a barber shop, anything simple) and set up its basic site structure in WordPress.",
          instructions:
            "For your chosen business:\n1. Set the Site Title and Tagline (Settings → General) to match the business\n2. Create these Pages with real, written (not placeholder) content: Home, About, Services, Contact\n3. Upload a logo or header image to the Media Library and add it somewhere on the Home page\n4. Create a navigation Menu containing all four pages, correctly ordered\n5. Assign the menu to your theme's primary location",
          deliverables: [
            'A live (or locally running) WordPress site with all 4 pages and working navigation',
            'A shareable link to the site (or a note describing local access if using a local tool)',
          ],
          dueOffsetDays: 6,
          maxScore: 100,
          rubric: {
            structure: 'All 4 required pages exist with real content — 40 pts',
            navigation: 'Menu is correctly built and assigned — 25 pts',
            branding: 'Site title/tagline and a logo/header image are set — 20 pts',
            clarity: 'Content clearly matches the chosen business — 15 pts',
          },
        },
      ],
    },
    {
      weekNumber: 2,
      title: 'Theme Customization and Plugins',
      objectives: [
        "Customize a theme's identity, colors, typography, and layout",
        'Explain what a plugin is and install one correctly',
        'Configure a working contact form',
      ],
      summary:
        'Make the site actually look like a real brand, and add real functionality with plugins.',
      estimatedStudyHours: 7,
      lessons: [
        {
          title: 'Site Identity, Colors, and Typography',
          lessonType: 'article',
          estimatedDurationMinutes: 25,
          completionRequired: true,
          description:
            'Appearance → Customize (or the Site Editor, depending on your theme) is where you control the visual identity without touching code.\n\n- Site Identity: logo, site icon (favicon), title display\n- Colors: most themes expose a small set of color roles (background, text, accent/button color) — pick 2-3 colors and apply them consistently rather than a different color per page\n- Typography: heading font vs body font — many themes let you pick from Google Fonts directly in the customizer\n\nA simple, reliable approach for a beginner: one accent color used only for buttons/links, one dark neutral for text, one light neutral for backgrounds. Consistency reads as "professional" far more than variety does.',
        },
        {
          title: 'Layout, Headers, and Footers',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'Most WordPress themes let you customize the header (top of every page — usually logo + navigation) and footer (bottom of every page — usually contact info, copyright, sometimes a second small menu) from Appearance → Customize.\n\nGood defaults for a small-business site:\n- Header: logo on the left, navigation on the right, kept simple\n- Footer: business name + copyright year, an email or phone number, links to social media if relevant\n\nThese two areas appear on EVERY page, so anything you put there should be genuinely useful on every single page — avoid stuffing the footer with content that only matters on one page.',
        },
        {
          title: 'Responsive Design in WordPress',
          lessonType: 'reading',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'Most modern WordPress themes are already responsive (they adapt to phone/tablet/desktop automatically) — your job is mostly to AVOID breaking that, rather than building it from scratch like in the Web Development track.\n\nCommon ways beginners accidentally break responsiveness:\n- Uploading huge, unresized images that make mobile pages slow\n- Setting a FIXED pixel width on a content block instead of letting it flow\n- Adding too many items to a navigation menu, so it overflows on small screens\n\nAlways preview your site at different widths — most theme customizers have a small desktop/tablet/mobile preview toggle. Check your site there before considering a page "done."',
        },
        {
          title: 'Plugins: What They Are, and Installing One Safely',
          lessonType: 'video',
          estimatedDurationMinutes: 30,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/BftqYTJRQuE',
          description:
            'A plugin adds functionality WordPress doesn\'t have by default — a contact form, SEO tools, an image gallery, e-commerce.\n\nTo install one: Plugins → Add New → search by name → Install → Activate.\n\nSensible plugin hygiene for a beginner:\n- Only install plugins you actually need — each one is a small amount of extra risk/slowdown\n- Check the "active installations" and last-updated date before installing an unfamiliar one\n- Keep plugins updated (Plugins page shows available updates)\n\nThis video walks through several genuinely useful beginner plugin categories — this week you only need ONE of them (a contact form plugin), but it is worth knowing what else exists.',
        },
        {
          title: 'Configuring a Contact Form',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            "A contact form is the most important single piece of functionality on a small-business site — it is how visitors actually reach the business.\n\nAfter installing a contact-form plugin (many popular ones exist — pick any well-reviewed one):\n1. Create a new form from the plugin's menu\n2. Keep required fields minimal: Name, Email, Message — extra fields reduce how many people finish filling it in\n3. Set the notification email to the business's real address\n4. Copy the shortcode or block the plugin gives you\n5. Paste it onto your Contact page\n6. Submit a real test message yourself to confirm it arrives\n\nA form that exists but was never test-submitted is not actually verified — always send yourself one test message before considering it done.",
        },
      ],
      resources: [
        {
          title: 'Essential WordPress Plugins for beginners',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=BftqYTJRQuE',
          provider: 'YouTube',
          estimatedDurationMinutes: 30,
          isRequired: true,
        },
        {
          title: 'WordPress.org — Plugins Directory',
          resourceType: 'official_documentation',
          url: 'https://wordpress.org/plugins/',
          provider: 'WordPress.org',
          isRequired: true,
          notes:
            'Browse only official, reviewed plugins here rather than downloading from unknown sites.',
        },
        {
          title: 'Google Fonts',
          resourceType: 'other',
          url: 'https://fonts.google.com/',
          isRequired: false,
          notes: 'Many WordPress theme customizers let you pick any of these directly.',
        },
        {
          title: 'Yoast SEO plugin page',
          resourceType: 'other',
          url: 'https://wordpress.org/plugins/wordpress-seo/',
          isRequired: false,
          notes:
            'The most widely used beginner SEO plugin — optional this week, but good to know exists.',
        },
      ],
      tasks: [
        {
          title: 'Practice: Customize Site Identity',
          description: 'A quick, low-stakes styling pass before the graded assignment.',
          instructions:
            'In Appearance → Customize, set a site icon (favicon), pick an accent color, and change the body font to something from Google Fonts if your theme supports it.',
          deliverables: [
            "A note describing the 3 changes you made, in your submission link's notes",
          ],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Design and Configure a WordPress Business Site',
          description:
            "Build on last week's site structure: give it a real visual identity and a working contact form.",
          instructions:
            'On the site you structured last week:\n1. Set a consistent color scheme (2-3 colors) and typography via the Customizer\n2. Style the header (logo + nav) and footer (contact info + copyright)\n3. Preview and fix the site at mobile width — no overflowing menus or oversized images\n4. Install a contact-form plugin, build a Name/Email/Message form, and add it to your Contact page\n5. Send yourself a real test submission and confirm it arrives',
          deliverables: [
            'A shareable link to the updated, styled site',
            'Confirmation (a note, or the received email) that the contact form works',
          ],
          dueOffsetDays: 6,
          maxScore: 100,
          rubric: {
            visualIdentity: 'Consistent, deliberate color scheme and typography — 30 pts',
            headerFooter: 'Header and footer are styled and genuinely useful — 20 pts',
            responsive: 'Site checked and correct at mobile width — 20 pts',
            contactForm: 'Working, tested contact form on the Contact page — 30 pts',
          },
        },
      ],
    },
    {
      weekNumber: 3,
      title: 'Building the Complete Website',
      objectives: [
        'Assemble a complete, coherent small-business website',
        'Write effective calls to action',
        'Apply basic performance and security hygiene before launch',
      ],
      summary: 'Bring everything together into one finished, presentable business website.',
      estimatedStudyHours: 8,
      lessons: [
        {
          title: 'Homepage Structure That Actually Works',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'A homepage that converts visitors follows a predictable, proven structure:\n\n1. Hero section — business name, one clear sentence of what you do, one prominent button (a "call to action")\n2. What you offer — a short summary of services/products, often 3 items in a row\n3. Why choose us / social proof — a short testimonial, years of experience, or a simple trust statement\n4. A second call to action near the bottom — visitors who scrolled this far are interested; give them another chance to act\n\nResist the urge to put everything on the homepage. Its only job is to quickly tell a visitor "you are in the right place" and point them to About, Services, or Contact.',
        },
        {
          title: 'Writing Effective Calls to Action',
          lessonType: 'article',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'A "call to action" (CTA) is the button or link that tells a visitor exactly what to do next: "Book a Consultation", "Get a Free Quote", "Contact Us Today".\n\nWeak CTA: "Click Here" (tells you nothing)\nStrong CTA: "Get Your Free Quote" (tells you exactly what happens and what it costs)\n\nEvery page should have at least one clear CTA, and it should point somewhere useful — usually the Contact page or the contact form itself. A page with no CTA leaves the visitor to guess what to do next, and most will simply leave.',
        },
        {
          title: 'About, Services, and Contact Pages Done Well',
          lessonType: 'reading',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            "About page: answer WHO you are and WHY someone should trust you — a short story, credentials, or years of experience. Avoid generic filler; be specific about this particular business.\n\nServices page: list what you actually offer, one short description per service. If pricing is simple and public, include it — uncertainty about cost is a common reason visitors leave without contacting you.\n\nContact page: the working form from Week 2, PLUS a direct email/phone as a fallback in case someone doesn't trust forms, and — if relevant — a physical address or service area.\n\nEach of these three pages should end with a CTA pointing to the Contact page (except Contact itself, which IS the destination).",
        },
        {
          title: 'Basic Performance and Security Hygiene',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'Before calling a site done, a short hygiene pass:\n\nPerformance:\n- Compress images before uploading (large, unresized photos are the #1 cause of slow WordPress sites)\n- Remove any plugin or theme you installed to test but did not end up using\n\nSecurity and maintenance:\n- Use a strong, unique admin password\n- Keep WordPress core, your theme, and all plugins updated\n- Keep a backup — many hosts offer this automatically, or a backup plugin can handle it\n\nThese are quick checks, not a deep audit — the goal is avoiding the most common, easily preventable problems, not building a security system.',
        },
        {
          title: 'Final Polish and Launch Checklist',
          lessonType: 'video',
          estimatedDurationMinutes: 35,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/axDdVDteEqQ',
          description:
            'A last pass before treating a site as launched:\n\n- Click every link and every menu item — do they all go somewhere real?\n- Submit the contact form one more time\n- Check spelling and that placeholder text ("Lorem ipsum", "Coming soon") is gone everywhere\n- Preview at mobile width one more time\n- Confirm the Site Title/Tagline and favicon are set\n\nThis video walks through exactly this kind of final build-and-polish pass on a real WordPress site, useful as a model for your own final review before submitting this week\'s assignment.',
        },
      ],
      resources: [
        {
          title: 'How to Make a Website with WordPress + FREE Template Download',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=axDdVDteEqQ',
          provider: 'YouTube',
          estimatedDurationMinutes: 35,
          isRequired: true,
        },
        {
          title: 'WordPress.org — Documentation',
          resourceType: 'official_documentation',
          url: 'https://wordpress.org/documentation/',
          provider: 'WordPress.org',
          isRequired: false,
        },
        {
          title: 'TinyPNG (image compression tool)',
          resourceType: 'other',
          url: 'https://tinypng.com/',
          isRequired: false,
          notes:
            'A free tool to compress images before uploading them — directly addresses the "performance hygiene" lesson.',
        },
      ],
      tasks: [
        {
          title: 'Practice: Link and Content Audit',
          description: 'A quick self-check pass before the final assignment.',
          instructions:
            'Click through every page and every menu item on your site. Fix any broken link, and remove any leftover placeholder text.',
          deliverables: ['A short note listing what you fixed'],
          dueOffsetDays: 2,
          maxScore: 10,
        },
        {
          title: 'Assignment: Build and Present a Complete Business Website',
          description:
            'The capstone for the WordPress track: a fully built, polished, presentable small-business website.',
          instructions:
            'Finish your business website to a presentable, "ready to show a client" standard:\n1. Homepage follows the hero → offerings → trust → CTA structure covered this week\n2. Every page (Home, About, Services, Contact) has a clear, specific call to action\n3. Images are reasonably sized/compressed\n4. Full link-and-content audit completed — no broken links or placeholder text anywhere\n5. Write a short (3-5 sentence) summary of the business and what you built, to submit alongside the link',
          deliverables: [
            'A shareable link to the finished, complete website',
            'A short written summary of the business and site',
          ],
          dueOffsetDays: 7,
          maxScore: 100,
          rubric: {
            completeness: 'All pages present, coherent, and polished — 30 pts',
            homepageStructure: 'Homepage follows an effective, logical structure — 25 pts',
            callsToAction: 'Clear, specific CTAs on every page — 20 pts',
            hygiene: 'No broken links/placeholder text; images reasonably sized — 25 pts',
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Graphics Design
// ---------------------------------------------------------------------------

const GRAPHICS_DESIGN: TrackSeed = {
  name: 'Graphics Design',
  slug: 'graphics-design',
  description:
    'Learn the core principles behind effective visual design — typography, color, composition — and apply them using accessible design tools to produce real, portfolio-ready work: a social post, a flyer, and a small brand identity.',
  difficulty: 'beginner',
  estimatedWeeks: 3,
  learningOutcomes: [
    'Apply core design principles: contrast, alignment, hierarchy, spacing',
    'Choose and combine typography and color palettes deliberately',
    'Produce a polished social media design and promotional flyer',
    'Assemble a small, consistent brand identity system',
  ],
  tags: ['graphic-design', 'branding', 'visual-design'],
  courseTitle: 'Graphics Design Foundations',
  courseSlug: 'graphics-design-foundations',
  courseOverview:
    'A principles-first, tool-agnostic introduction to graphic design, applied every week to a real, portfolio-worthy deliverable using free design tools (Canva or Figma).',
  courseObjectives: [
    'Understand and apply the core principles of visual design',
    'Work confidently in a modern design tool',
    'Produce a small, consistent brand identity system',
  ],
  completionCriteria:
    'Complete all required lessons and resources in each week, and submit all three weekly assignments.',
  estimatedHours: 20,
  weeks: [
    {
      weekNumber: 1,
      title: 'Design Principles and Fundamentals',
      objectives: [
        'Explain and apply contrast, alignment, hierarchy, and spacing',
        'Choose fonts and colors deliberately, not randomly',
        'Read and respond to a simple design brief',
      ],
      summary: 'The principles behind every good design, before touching any tool.',
      estimatedStudyHours: 6,
      lessons: [
        {
          title: 'What Graphic Design Actually Is',
          lessonType: 'video',
          estimatedDurationMinutes: 24,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/SGT1l9AukLc',
          description:
            'Graphic design is not decoration — it is communication using visuals. A well-designed poster, social post, or logo does a JOB: it grabs attention, communicates one clear message, and (usually) prompts an action.\n\nEvery design decision this week should be justified by that job, not by "it looks nice." Before opening any tool, always ask: who is this for, and what is the ONE thing I want them to notice first?\n\nThis video covers the core principles you\'ll use all week — typography, color theory, contrast, alignment, and hierarchy — with real examples of how big brands apply them.',
        },
        {
          title: 'Contrast, Alignment, and Hierarchy',
          lessonType: 'article',
          estimatedDurationMinutes: 25,
          completionRequired: true,
          description:
            "Three principles that do most of the work in any design:\n\nContrast — making different things look clearly different. A large, bold headline next to small, light body text is contrast; it tells the eye what matters most. Low contrast (similar sizes/weights everywhere) makes a design feel flat and hard to scan.\n\nAlignment — every element should line up with something else, deliberately. Nothing should float in a slightly-off position by accident. Pick one alignment (usually left, or centered) and apply it consistently — mixing alignments randomly is one of the fastest ways to make a design look unpolished.\n\nHierarchy — the order in which someone's eye moves through a design: biggest/boldest first, down to smallest/lightest last. Decide the hierarchy on purpose: headline → subheading → body → fine print, and size/weight each accordingly.\n\nA useful exercise: squint at a design you admire until the details blur. What is the FIRST thing you still notice? If it is not the most important message, the hierarchy needs work.",
        },
        {
          title: 'Typography Basics',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'A font choice communicates tone before anyone reads a single word. Rounded, friendly fonts feel approachable; sharp, geometric fonts feel modern/technical; serif fonts (with small feet on the letters) feel traditional/trustworthy.\n\nBeginner-safe rules:\n- Use at most 2 fonts per design: one for headlines, one for body text. More than that usually looks chaotic.\n- Pair a DIFFERENT font for headlines vs body (e.g. a bold sans-serif headline with a simple, readable body font) rather than two very similar fonts.\n- Body text should be easy to read at a glance — avoid decorative/script fonts for anything longer than a few words.\n- Leave enough line spacing (roughly 120-150% of the font size) — cramped text is hard to read.\n\nGoogle Fonts is a free, reliable source with thousands of options, many with pre-suggested pairings.',
        },
        {
          title: 'Color Theory Basics',
          lessonType: 'video',
          estimatedDurationMinutes: 12,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/Tznnrjkhp7E',
          description:
            'A simple, reliable color approach for a beginner:\n\n- Pick ONE dominant color (usually connected to the brand/mood)\n- Pick ONE neutral (near-black or near-white) for most text\n- Pick at most ONE accent color, used sparingly, for the single most important element (a button, a highlight)\n\nColor relationships worth knowing:\n- Complementary colors (opposite on the color wheel) create high contrast and energy — good for a single accent, overwhelming as a whole palette\n- Analogous colors (next to each other on the wheel) feel calm and cohesive — safer for a full palette\n\nFree tools like Coolors.co can generate a matching palette from a single starting color in seconds — a reliable shortcut while you build your eye for color.',
        },
        {
          title: 'Reading a Design Brief',
          lessonType: 'reading',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            "A design brief is a short description of what a design needs to achieve — audience, message, and any constraints (size, required text, brand colors if any exist).\n\nBefore starting any design, always identify:\n1. Audience — who is this for? (Affects tone, color, font choice)\n2. One key message — what is the single most important thing to communicate?\n3. Format/size — a square social post is designed differently from a tall flyer\n4. Any fixed requirements — a logo that must be included, specific text that must appear\n\nThis week's task includes a short brief for exactly this reason: to practice translating a brief into design decisions, not just making something that looks nice in isolation.",
        },
      ],
      resources: [
        {
          title: 'Graphic Design for Beginners | Typography, Color Theory, & More',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=SGT1l9AukLc',
          provider: 'YouTube',
          estimatedDurationMinutes: 24,
          isRequired: true,
        },
        {
          title: 'Color Theory for Graphic Design: How to Choose Better Colors',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=Tznnrjkhp7E',
          provider: 'YouTube',
          estimatedDurationMinutes: 12,
          isRequired: true,
        },
        {
          title: 'Coolors — color palette generator',
          resourceType: 'other',
          url: 'https://coolors.co/',
          isRequired: false,
          notes: 'Generate a matching color palette from one starting color.',
        },
        {
          title: 'Google Fonts',
          resourceType: 'other',
          url: 'https://fonts.google.com/',
          isRequired: false,
        },
      ],
      tasks: [
        {
          title: 'Practice: Typography Pairing Exercise',
          description: 'A quick exercise to practice choosing fonts deliberately.',
          instructions:
            'Using Canva or Figma (free), create a simple slide with a headline and one paragraph of body text. Try 3 different font pairings for the same text and pick your favourite, in one image.',
          deliverables: ['An exported image showing your 3 font-pairing attempts'],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Design Fundamentals Social Post',
          description:
            "This week's brief: design a square social media post announcing a free community coding workshop.",
          instructions:
            'Brief: "Tech Impact Fellowship is hosting a free 2-hour Intro to Coding workshop for beginners, this Saturday at 10am, at the community center. Design a square (1080x1080px) social media post announcing it."\n\nRequirements:\n1. Include all the key facts from the brief (what, when, where)\n2. Use exactly 2 fonts, one for the headline and one for the body\n3. Use a deliberate 2-3 color palette (you may use a Coolors palette)\n4. Apply clear visual hierarchy — the headline should be the first thing anyone notices\n5. Export as a PNG or JPG',
          deliverables: [
            'The exported square social post image',
            'A shareable link to the design file (Canva "Share" or Figma "Share" link)',
          ],
          dueOffsetDays: 6,
          maxScore: 100,
          rubric: {
            brief: 'All key facts from the brief are present and legible — 25 pts',
            typography: 'Exactly 2 well-paired fonts, used consistently — 25 pts',
            color: 'Deliberate, limited color palette — 20 pts',
            hierarchy: 'Clear visual hierarchy; headline reads first — 30 pts',
          },
        },
      ],
    },
    {
      weekNumber: 2,
      title: 'Working with Design Tools',
      objectives: [
        'Work confidently with shapes, layers, images, and grids in a design tool',
        'Combine typography systems with a grid-based layout',
        'Apply basic image treatment to make photos usable in a design',
      ],
      summary: "Get hands-on and comfortable in a real design tool, using this week's principles.",
      estimatedStudyHours: 7,
      lessons: [
        {
          title: 'Getting Comfortable in Canva',
          lessonType: 'video',
          estimatedDurationMinutes: 30,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/UwThwHPgsIw',
          description:
            "Canva is a free, browser-based design tool — a good starting point because it removes most technical friction and lets you focus on design decisions.\n\nCore concepts you'll use constantly:\n- Elements panel — shapes, lines, icons, stock photos\n- Text tool — add and style text boxes; Canva shows font pairing suggestions automatically\n- Layers — later elements sit ON TOP of earlier ones; drag in the layers panel (or right-click → order) to rearrange\n- Alignment tools — select 2+ elements and use Canva's align/distribute options for pixel-perfect alignment, rather than eyeballing it\n\n(If you prefer Figma instead of Canva, the same underlying design principles apply — the concepts below translate directly, only the exact menu names differ.)",
        },
        {
          title: 'Shapes, Layers, and Grids',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'A grid is an invisible structure of columns/rows that keeps elements aligned to consistent positions, rather than placed freehand. Most design tools offer a "show grid" or ruler/guide feature — turn it on.\n\nPractical grid habits:\n- Keep consistent margins on all four edges (do not let text touch the exact edge of the canvas)\n- Align related elements to the same invisible vertical or horizontal line\n- Group elements that belong together, so they move as one unit\n\nSimple shapes (rectangles, circles, lines) are a fast way to create structure — a colored rectangle behind text instantly creates a "card," a thin line separates two sections without needing a hard border.',
        },
        {
          title: 'Combining Typography Systems',
          lessonType: 'reading',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'Building on Week 1\'s font-pairing basics: a full "type system" for one design usually has 3 levels, each with a fixed size/weight used consistently:\n\n1. Headline — largest, boldest\n2. Subheading/supporting text — medium, often the accent color\n3. Body/details — smallest, always highly readable\n\nOnce you decide these three sizes for one project, keep them EXACTLY consistent everywhere that type of text appears — this consistency is what makes a set of designs (e.g. a flyer and a matching social post) feel like they belong to the same brand, more than color does.',
        },
        {
          title: 'Working with Images',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            "A photo dropped into a design without treatment often clashes with everything around it. Simple, reliable treatments:\n\n- Duotone/color overlay — apply a semi-transparent color rectangle over a photo so it matches your palette instead of fighting it\n- Cropping — crop to the SAME aspect ratio consistently across a set of designs (e.g. always square, or always 4:3)\n- Text on images — always increase contrast between text and photo, either with a solid dark rectangle behind the text, or a dark gradient overlay across the bottom of the photo\n\nRule of thumb: text over a photo should be readable even if you squint. If it isn't, add an overlay or a solid background behind just the text.",
        },
        {
          title: 'Layout Systems for a Consistent Set of Designs',
          lessonType: 'article',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'When you need MULTIPLE related designs (a flyer + a matching social post, for example), a layout system keeps them feeling related:\n\n- Reuse the same 2-3 colors and 2 fonts across every piece\n- Reuse the same logo/mark placement (e.g. always bottom-right, same size)\n- Reuse the same type hierarchy sizes\n\nThis is the exact same underlying idea as CSS classes in the Web Development track, or a WordPress theme in the WordPress track: define the system once, apply it consistently everywhere, rather than re-deciding font/color/spacing from scratch on every new design.',
        },
      ],
      resources: [
        {
          title: 'Canva Tutorial for Beginners (How to Master Canva)',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=UwThwHPgsIw',
          provider: 'YouTube',
          estimatedDurationMinutes: 30,
          isRequired: true,
        },
        {
          title: 'Canva — official site',
          resourceType: 'official_documentation',
          url: 'https://www.canva.com/',
          provider: 'Canva',
          isRequired: true,
        },
        {
          title: 'Figma — official site',
          resourceType: 'official_documentation',
          url: 'https://www.figma.com/',
          provider: 'Figma',
          isRequired: false,
          notes: 'A free alternative to Canva if you prefer a more precise, layer-based tool.',
        },
        {
          title: 'Coolors — color palette generator',
          resourceType: 'other',
          url: 'https://coolors.co/',
          isRequired: false,
        },
      ],
      tasks: [
        {
          title: 'Practice: Recreate a Simple Layout',
          description: 'Practice grid alignment before the graded assignment.',
          instructions:
            "Find any well-designed poster or ad online. Without copying its exact content, recreate its LAYOUT structure (where the headline sits, where the image sits, how it's aligned) using your own text and colors.",
          deliverables: ['The exported recreated layout'],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Promotional Flyer Challenge',
          description:
            "Design a complete promotional flyer for the same fictional/real business you can carry into Week 3's branding project.",
          instructions:
            'Design an A5 or Letter-sized promotional flyer for a small business of your choice (a cafe, tutoring service, event, or the workshop from Week 1 — your choice). Requirements:\n1. Use a grid — consistent margins, aligned elements\n2. Apply a 3-level type hierarchy (headline / supporting text / details) exactly as covered this week\n3. Include at least one image with a treatment applied (overlay, consistent crop, or a background rectangle behind text)\n4. Use the same color palette approach from Week 1 (1 dominant + 1 neutral + 1 accent)\n5. Export as PNG or PDF',
          deliverables: ['The exported flyer', 'A shareable link to the design file'],
          dueOffsetDays: 6,
          maxScore: 100,
          rubric: {
            layout: 'Consistent grid, alignment, and margins — 25 pts',
            hierarchy: 'Clear 3-level type hierarchy — 25 pts',
            imageTreatment: 'At least one deliberate image treatment applied — 20 pts',
            colorConsistency: 'Deliberate, consistent color palette — 30 pts',
          },
        },
      ],
    },
    {
      weekNumber: 3,
      title: 'Brand Identity Basics',
      objectives: [
        'Explain the core pieces of a simple visual identity system',
        'Design a basic logo concept',
        'Assemble a small, consistent brand identity system',
      ],
      summary:
        "Turn this track's principles and tool skills into a small, cohesive brand identity.",
      estimatedStudyHours: 7,
      lessons: [
        {
          title: 'What a Brand Identity Actually Includes',
          lessonType: 'reading',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'A brand identity is the consistent visual system a business uses everywhere, so it is instantly recognizable. At a beginner level, a simple identity needs just 4 pieces:\n\n1. A logo (or simple logotype/wordmark)\n2. A color palette (the same 2-3 colors from Weeks 1-2, made official)\n3. A type system (the same 2 fonts, made official)\n4. One example application (a social post OR a flyer, showing the system in use)\n\nThat is genuinely enough to call it a "brand identity" at this level — you do not need business cards, packaging, or a full style guide document for this track. The goal is CONSISTENCY across a small set of pieces, not volume.',
        },
        {
          title: 'Logo Concepts for Beginners',
          lessonType: 'video',
          estimatedDurationMinutes: 60,
          completionRequired: true,
          resourceUrl: 'https://www.youtube.com/embed/l9_BM1opTj8',
          description:
            "Three beginner-friendly logo types, from simplest to most involved:\n\n1. Wordmark — the business name itself, set in a distinctive font (e.g. how many well-known brands are simply their name in a specific typeface)\n2. Lettermark — an initial or short set of initials in a distinctive style\n3. Simple icon + wordmark — one simple geometric shape or icon paired with the business name\n\nFor this week's assignment, a wordmark or lettermark is a completely legitimate, professional choice — you do not need to design a complex icon. Keep it simple enough that it still looks correct shrunk down small (test this by shrinking your design to the size of a social media profile photo).\n\nThis full course goes deeper into the logo design process if you want to attempt a simple icon + wordmark instead.",
        },
        {
          title: 'Building a Color Palette System',
          lessonType: 'article',
          estimatedDurationMinutes: 15,
          completionRequired: true,
          description:
            'Formalize the color choices you\'ve been making since Week 1 into an official small palette:\n\n- Primary color — the main brand color, used for the logo and most prominent elements\n- Neutral — near-black for text, near-white for backgrounds\n- Accent (optional) — one additional color used sparingly for emphasis\n\nWrite down the exact hex codes (e.g. #1A1A2E) you land on — this is what makes a palette "official" and reusable, rather than approximately re-picked each time. Every future design for this brand should reuse these exact codes.',
        },
        {
          title: 'A Type System for the Brand',
          lessonType: 'reading',
          estimatedDurationMinutes: 10,
          completionRequired: true,
          description:
            "Similarly, formalize your type choices:\n\n- Headline font: [the font you've been using for headlines]\n- Body font: [the font you've been using for body text]\n\nWrite these down alongside your color codes. Together, the color palette + type system is the actual reusable \"system\" behind a brand identity — simple to write down, and this is exactly what keeps a brand's design consistent across many different pieces over time.",
        },
        {
          title: 'Assembling the Final Identity System',
          lessonType: 'article',
          estimatedDurationMinutes: 20,
          completionRequired: true,
          description:
            'Bring it together into one final design file/board containing:\n\n1. Your logo (from earlier this week), shown at 2 sizes (normal, and shrunk small) to confirm it still reads clearly\n2. Your color palette, shown as labeled swatches with hex codes\n3. Your type system, shown as sample headline + body text in your chosen fonts\n4. One example application — your Week 2 flyer, or a new social post, redesigned using this now-official system\n\nThis is your mini brand identity project — a genuinely useful, portfolio-ready artifact showing you can carry one consistent visual system across multiple pieces, which is the core skill real graphic design work depends on.',
        },
      ],
      resources: [
        {
          title: 'FULL 1 Hour Logo Design Course',
          resourceType: 'youtube_video',
          url: 'https://www.youtube.com/watch?v=l9_BM1opTj8',
          provider: 'YouTube',
          estimatedDurationMinutes: 60,
          isRequired: true,
        },
        {
          title: 'Coolors — color palette generator',
          resourceType: 'other',
          url: 'https://coolors.co/',
          isRequired: false,
        },
        {
          title: 'Google Fonts',
          resourceType: 'other',
          url: 'https://fonts.google.com/',
          isRequired: false,
        },
      ],
      tasks: [
        {
          title: 'Practice: Logo Shrink Test',
          description: 'A quick, practical check before finalizing your logo.',
          instructions:
            'Take your logo concept and place it at 3 sizes on one canvas: large, medium, and as small as a social media profile photo (roughly 150x150px). Confirm it is still legible at the smallest size — adjust if not.',
          deliverables: ['The exported 3-size comparison image'],
          dueOffsetDays: 3,
          maxScore: 10,
        },
        {
          title: 'Assignment: Mini Brand Identity Project',
          description:
            "The capstone for the Graphics Design track: a complete, consistent mini brand identity for the business you've been designing for since Week 1 or 2.",
          instructions:
            'Assemble one final design file/board containing all 4 pieces covered this week:\n1. A logo (wordmark, lettermark, or icon+wordmark), tested at a small size\n2. An official color palette with hex codes\n3. An official 2-font type system\n4. One example application (a social post or flyer) using the finished system\n\nEverything should visibly use the SAME colors and fonts as your Week 1-2 work — this project is about pulling those decisions together into one coherent, official system, not starting over.',
          deliverables: [
            'The exported final brand identity board/file',
            'A shareable link to the design file',
          ],
          dueOffsetDays: 7,
          maxScore: 100,
          rubric: {
            logo: 'Simple, legible logo that works at a small size — 25 pts',
            colorSystem: 'Palette documented with hex codes — 20 pts',
            typeSystem: 'Type system documented and consistently applied — 20 pts',
            consistency: 'Example application clearly uses the same system — 35 pts',
          },
        },
      ],
    },
  ],
};

const TRACKS: TrackSeed[] = [WEB_DEVELOPMENT, WORDPRESS, GRAPHICS_DESIGN];

// ---------------------------------------------------------------------------
// Find-or-create helpers — org/academy/fellowship/cohort
// ---------------------------------------------------------------------------

async function findOrCreateOrganization() {
  const slug = process.env.SEED_ORGANIZATION_SLUG ?? 'platform';
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.organization.create({
    data: {
      name: process.env.SEED_ORGANIZATION_NAME ?? 'Tech Impact Fellowship',
      slug,
      status: 'active',
    },
  });
}

async function findOrCreateAcademy(organizationId: string) {
  const slug = 'ota-doyen';
  const existing = await prisma.academy.findFirst({
    where: { organizationId, slug, deletedAt: null },
  });
  if (existing) return existing;
  // Fall back to any academy already hosting a "Tech Impact Fellowship" —
  // covers this dev database's real history without creating a duplicate.
  const viaFellowship = await prisma.academy.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      fellowships: { some: { title: { contains: 'Tech Impact', mode: 'insensitive' } } },
    },
  });
  if (viaFellowship) return viaFellowship;
  return prisma.academy.create({
    data: {
      organizationId,
      name: 'Ota Doyen',
      slug,
      status: 'active',
      description: 'The academy running the Tech Impact Fellowship programme.',
      isPublic: true,
    },
  });
}

async function findOrCreateFellowship(organizationId: string, academyId: string) {
  const slug = 'tech-impact-fellowship';
  const existing = await prisma.fellowship.findFirst({ where: { organizationId, slug } });
  if (existing) return existing;
  return prisma.fellowship.create({
    data: {
      organizationId,
      academyId,
      title: 'Tech Impact Fellowship',
      slug,
      status: 'published',
      durationWeeks: 12,
      summary: 'A mentor-guided, project-based fellowship in practical tech skills.',
      isPublic: true,
    },
  });
}

async function findOrCreateCohort1(
  organizationId: string,
  academyId: string,
  fellowshipId: string,
) {
  const slug = 'cohort-1';
  const existing = await prisma.cohort.findFirst({ where: { fellowshipId, slug } });
  // "Active/current for testing" — start a couple of weeks ago so the cohort
  // reads as already under way, end ~10 weeks out.
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() - 14);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 12 * 7);

  if (existing) {
    if (existing.status !== 'active') {
      return prisma.cohort.update({
        where: { id: existing.id },
        data: { status: 'active', startsAt, endsAt },
      });
    }
    return existing;
  }
  return prisma.cohort.create({
    data: {
      organizationId,
      academyId,
      fellowshipId,
      name: 'Cohort 1',
      slug,
      status: 'active',
      startsAt,
      endsAt,
      timezone: 'Africa/Lagos',
      capacity: 30,
    },
  });
}

// ---------------------------------------------------------------------------
// Track/course/week content upsert
// ---------------------------------------------------------------------------

async function upsertTrack(organizationId: string, fellowshipId: string, seed: TrackSeed) {
  const existingTrack = await prisma.learningTrack.findFirst({
    where: { fellowshipId, slug: seed.slug },
  });
  const trackData = {
    name: seed.name,
    description: seed.description,
    difficulty: seed.difficulty,
    estimatedWeeks: seed.estimatedWeeks,
    learningOutcomes: seed.learningOutcomes,
    tags: seed.tags,
    status: PUBLISHED,
  };
  const track = existingTrack
    ? await prisma.learningTrack.update({ where: { id: existingTrack.id }, data: trackData })
    : await prisma.learningTrack.create({
        data: { organizationId, fellowshipId, slug: seed.slug, ...trackData },
      });

  const existingCourse = await prisma.course.findFirst({
    where: { learningTrackId: track.id, slug: seed.courseSlug },
  });
  const course = existingCourse
    ? await prisma.course.update({
        where: { id: existingCourse.id },
        data: {
          title: seed.courseTitle,
          overview: seed.courseOverview,
          objectives: seed.courseObjectives,
          completionCriteria: seed.completionCriteria,
          estimatedHours: seed.estimatedHours,
          status: PUBLISHED,
        },
      })
    : await prisma.course.create({
        data: {
          organizationId,
          learningTrackId: track.id,
          title: seed.courseTitle,
          slug: seed.courseSlug,
          overview: seed.courseOverview,
          objectives: seed.courseObjectives,
          completionCriteria: seed.completionCriteria,
          estimatedHours: seed.estimatedHours,
          status: PUBLISHED,
        },
      });

  for (const week of seed.weeks) {
    const existingModule = await prisma.weeklyModule.findFirst({
      where: { courseId: course.id, weekNumber: week.weekNumber },
    });
    const weeklyModule = existingModule
      ? await prisma.weeklyModule.update({
          where: { id: existingModule.id },
          data: {
            title: week.title,
            objectives: week.objectives,
            summary: week.summary,
            estimatedStudyHours: week.estimatedStudyHours,
            requiresPracticalWork: true,
            status: PUBLISHED,
          },
        })
      : await prisma.weeklyModule.create({
          data: {
            organizationId,
            courseId: course.id,
            weekNumber: week.weekNumber,
            title: week.title,
            objectives: week.objectives,
            summary: week.summary,
            estimatedStudyHours: week.estimatedStudyHours,
            requiresPracticalWork: true,
            status: PUBLISHED,
          },
        });

    for (const [index, lesson] of week.lessons.entries()) {
      const existingLesson = await prisma.lesson.findFirst({
        where: { weeklyModuleId: weeklyModule.id, title: lesson.title },
      });
      const data = {
        title: lesson.title,
        description: lesson.description,
        lessonType: lesson.lessonType,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        resourceUrl: lesson.resourceUrl ?? null,
        completionRequired: lesson.completionRequired ?? true,
        displayOrder: index,
        status: PUBLISHED as CurriculumStatus,
      };
      if (existingLesson) {
        await prisma.lesson.update({ where: { id: existingLesson.id }, data });
      } else {
        await prisma.lesson.create({
          data: { organizationId, weeklyModuleId: weeklyModule.id, ...data },
        });
      }
    }

    for (const [index, resource] of week.resources.entries()) {
      const existingResource = await prisma.learningResource.findFirst({
        where: { weeklyModuleId: weeklyModule.id, title: resource.title },
      });
      const data = {
        resourceType: resource.resourceType,
        url: resource.url,
        title: resource.title,
        author: resource.author ?? null,
        provider: resource.provider ?? null,
        estimatedDurationMinutes: resource.estimatedDurationMinutes ?? null,
        isRequired: resource.isRequired ?? false,
        notes: resource.notes ?? null,
        displayOrder: index,
        status: PUBLISHED as CurriculumStatus,
      };
      if (existingResource) {
        await prisma.learningResource.update({ where: { id: existingResource.id }, data });
      } else {
        await prisma.learningResource.create({
          data: { organizationId, weeklyModuleId: weeklyModule.id, ...data },
        });
      }
    }

    for (const [index, task] of week.tasks.entries()) {
      const existingTask = await prisma.practicalTask.findFirst({
        where: { weeklyModuleId: weeklyModule.id, title: task.title },
      });
      const data = {
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        deliverables: task.deliverables,
        dueOffsetDays: task.dueOffsetDays,
        maxScore: task.maxScore,
        rubricMetadata: task.rubric ?? undefined,
        displayOrder: index,
        status: PUBLISHED as CurriculumStatus,
      };
      if (existingTask) {
        await prisma.practicalTask.update({ where: { id: existingTask.id }, data });
      } else {
        await prisma.practicalTask.create({
          data: { organizationId, weeklyModuleId: weeklyModule.id, ...data },
        });
      }
    }
  }

  return track;
}

// ---------------------------------------------------------------------------
// Curriculum snapshot — mirrors CurriculumSnapshotService.build() exactly,
// so Cohort 1's students actually see this content (see that service's own
// doc comment: the snapshot, not the live catalog, is what progression reads).
// ---------------------------------------------------------------------------

async function rebuildCurriculumSnapshot(
  organizationId: string,
  fellowshipId: string,
  cohortId: string,
) {
  const offered = await prisma.cohortLearningTrack.findMany({
    where: { cohortId },
    select: { learningTrackId: true },
  });
  const offeredTrackIds =
    offered.length > 0 ? offered.map((row) => row.learningTrackId) : undefined;

  const tracks = await prisma.learningTrack.findMany({
    where: {
      organizationId,
      fellowshipId,
      deletedAt: null,
      ...(offeredTrackIds ? { id: { in: offeredTrackIds } } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      courses: {
        where: { deletedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          weeklyModules: {
            where: { deletedAt: null },
            orderBy: { weekNumber: 'asc' },
            include: {
              lessons: {
                where: { deletedAt: null },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
              },
              resources: {
                where: { deletedAt: null },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
              },
              practicalTasks: {
                where: { deletedAt: null },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
              },
            },
          },
        },
      },
    },
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    fellowshipId,
    tracks: tracks.map((track) => ({
      id: track.id,
      name: track.name,
      slug: track.slug,
      description: track.description,
      difficulty: track.difficulty,
      estimatedWeeks: track.estimatedWeeks,
      learningOutcomes: track.learningOutcomes,
      status: track.status,
      displayOrder: track.displayOrder,
      courses: track.courses.map((course) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        displayOrder: course.displayOrder,
        weeklyModules: course.weeklyModules.map((weeklyModule) => ({
          id: weeklyModule.id,
          weekNumber: weeklyModule.weekNumber,
          title: weeklyModule.title,
          objectives: weeklyModule.objectives,
          summary: weeklyModule.summary,
          estimatedStudyHours: weeklyModule.estimatedStudyHours,
          status: weeklyModule.status,
          requiresMentorHuddle: weeklyModule.requiresMentorHuddle,
          requiresPracticalWork: weeklyModule.requiresPracticalWork,
          unlockRules: weeklyModule.unlockRules,
          huddleScheduleMetadata: weeklyModule.huddleScheduleMetadata,
          huddleMeetingLink: weeklyModule.huddleMeetingLink,
          mentorHuddleNotes: weeklyModule.mentorHuddleNotes,
          huddleAttendanceRequired: weeklyModule.huddleAttendanceRequired,
          lessons: weeklyModule.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            lessonType: lesson.lessonType,
            estimatedDurationMinutes: lesson.estimatedDurationMinutes,
            resourceUrl: lesson.resourceUrl,
            attachmentMetadata: lesson.attachmentMetadata,
            embeddedContentMetadata: lesson.embeddedContentMetadata,
            completionRequired: lesson.completionRequired,
            displayOrder: lesson.displayOrder,
            status: lesson.status,
          })),
          resources: weeklyModule.resources.map((resource) => ({
            id: resource.id,
            title: resource.title,
            resourceType: resource.resourceType,
            url: resource.url,
            author: resource.author,
            provider: resource.provider,
            estimatedDurationMinutes: resource.estimatedDurationMinutes,
            notes: resource.notes,
            isRequired: resource.isRequired,
            displayOrder: resource.displayOrder,
            status: resource.status,
          })),
          practicalTasks: weeklyModule.practicalTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            instructions: task.instructions,
            deliverables: task.deliverables,
            dueOffsetDays: task.dueOffsetDays,
            rubricMetadata: task.rubricMetadata,
            maxScore: task.maxScore,
            displayOrder: task.displayOrder,
            status: task.status,
          })),
        })),
      })),
    })),
  };

  await prisma.cohort.update({
    where: { id: cohortId },
    data: { curriculumSnapshot: snapshot as never, curriculumSnapshotAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Test student
// ---------------------------------------------------------------------------

async function seedTestStudent(
  organizationId: string,
  academyId: string,
  fellowshipId: string,
  cohortId: string,
) {
  const emailCanonical = 'student@techimpact.test';
  let user = await prisma.user.findUnique({ where: { emailCanonical } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        emailCanonical,
        displayName: 'Tech Impact Test Student',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
  }

  const passwordHash = await argon2.hash(TEST_STUDENT_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19_456),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  });
  await prisma.passwordCredential.upsert({
    where: { userId: user.id },
    update: { passwordHash, changedAt: new Date(), failedAttempts: 0, lockedUntil: null },
    create: { userId: user.id, passwordHash },
  });

  const membership = await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    update: { status: 'active', academyId },
    create: {
      organizationId,
      userId: user.id,
      academyId,
      status: 'active',
      joinedAt: new Date(),
    },
  });

  const studentRole = await prisma.role.findFirstOrThrow({
    where: { key: 'STUDENT', isSystem: true },
  });
  const existingGrant = await prisma.membershipRole.findFirst({
    where: { membershipId: membership.id, roleId: studentRole.id, revokedAt: null },
  });
  if (!existingGrant) {
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: studentRole.id },
    });
  }

  const academy = await prisma.academy.findUniqueOrThrow({ where: { id: academyId } });
  const enrollment = await prisma.enrollment.upsert({
    where: { cohortId_userId: { cohortId, userId: user.id } },
    update: { status: 'active', joinedAt: new Date() },
    create: {
      organizationId,
      academyId: academy.id,
      fellowshipId,
      cohortId,
      userId: user.id,
      status: 'active',
      joinedAt: new Date(),
    },
  });

  return { user, enrollment };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const organization = await findOrCreateOrganization();
  const academy = await findOrCreateAcademy(organization.id);
  const fellowship = await findOrCreateFellowship(organization.id, academy.id);
  const cohort = await findOrCreateCohort1(organization.id, academy.id, fellowship.id);

  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log(`Academy: ${academy.name} (${academy.id})`);
  console.log(`Fellowship: ${fellowship.title} (${fellowship.id})`);
  console.log(`Cohort: ${cohort.name} (${cohort.id})`);

  for (const trackSeed of TRACKS) {
    const track = await upsertTrack(organization.id, fellowship.id, trackSeed);
    await prisma.cohortLearningTrack.upsert({
      where: { cohortId_learningTrackId: { cohortId: cohort.id, learningTrackId: track.id } },
      update: {},
      create: { cohortId: cohort.id, learningTrackId: track.id },
    });
    console.log(`  Track ready: ${track.name} (${track.id})`);
  }

  await rebuildCurriculumSnapshot(organization.id, fellowship.id, cohort.id);
  console.log('Curriculum snapshot rebuilt for Cohort 1.');

  const { user, enrollment } = await seedTestStudent(
    organization.id,
    academy.id,
    fellowship.id,
    cohort.id,
  );
  console.log(`\nTest student ready: ${user.emailCanonical}`);
  console.log(`Password: ${TEST_STUDENT_PASSWORD}`);
  console.log(`Enrollment: ${enrollment.id} (status: ${enrollment.status}, no track chosen yet)`);
  console.log('\nDone. Log in as the test student and choose a track to begin.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
