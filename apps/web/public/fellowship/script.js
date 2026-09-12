/* Tech Impact Fellowship — public landing page.
 * Vanilla JS only: mobile nav, one-time scroll reveal, live catalog data,
 * and the application form — all calling the existing, already-shipped
 * public API (no parallel application system, no hardcoded course data).
 * See docs/adr/0011-public-fellowship-experience.md.
 */
(function () {
  'use strict';

  // Same default the React app's api/client.ts falls back to. A static
  // asset has no build-time env injection, so a real deployment serving
  // this page from a different origin than localhost must edit this one
  // line — disclosed in docs/KNOWN_TECHNICAL_DEBT.md.
  var API_BASE_URL = window.FELLOWSHIP_API_BASE_URL || 'http://localhost:3000/api/v1';

  /* ---------------- mobile nav ---------------- */

  var navToggle = document.querySelector('.nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');

  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
      mobileNav.hidden = isOpen;
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
        mobileNav.hidden = true;
      });
    });
  }

  /* ---------------- scroll reveal (once per element, not repeating —
     a storytelling page reads better settling in place than re-animating
     every time you scroll past it again) ---------------- */

  var revealTargets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealTargets.length) {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ---------------- live catalog data ---------------- */

  var DIFFICULTY_LABEL = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  var heroStatus = document.getElementById('hero-status');
  var trackGrid = document.getElementById('track-grid');
  var cohortPanel = document.getElementById('cohort-panel');
  var cohortSelect = document.getElementById('cohortId');
  var trackSelect = document.getElementById('trackId');

  // fellowships payload kept around so the track <select> can be
  // re-filtered to the chosen cohort's own fellowship on change.
  var catalog = [];

  function renderTracks(fellowships) {
    trackGrid.innerHTML = '';
    var allTracks = [];
    fellowships.forEach(function (f) {
      f.tracks.forEach(function (t) {
        allTracks.push({ fellowshipTitle: f.title, track: t });
      });
    });

    if (allTracks.length === 0) {
      trackGrid.appendChild(
        el('p', 'muted', 'Course tracks will be announced soon — check back shortly.'),
      );
      return;
    }

    allTracks.forEach(function (entry) {
      var card = el('article', 'track-card');
      var badge = el(
        'span',
        'track-card__badge',
        DIFFICULTY_LABEL[entry.track.difficulty] || entry.track.difficulty,
      );
      var title = el('h3', null, entry.track.name);
      var meta = el('p', 'muted', entry.fellowshipTitle);
      card.appendChild(badge);
      card.appendChild(title);
      card.appendChild(meta);
      trackGrid.appendChild(card);
    });
  }

  function renderCohorts(fellowships) {
    cohortPanel.innerHTML = '';
    var allCohorts = [];
    fellowships.forEach(function (f) {
      f.cohorts.forEach(function (c) {
        allCohorts.push({ fellowship: f, cohort: c });
      });
    });

    if (allCohorts.length === 0) {
      cohortPanel.appendChild(
        el(
          'p',
          'muted',
          'No cohort is currently open for applications. Check back soon, or submit your details below and we will reach out when the next one opens.',
        ),
      );
      heroStatus.textContent = 'No cohort is open for applications right now';
      heroStatus.setAttribute('data-state', 'closed');
      return;
    }

    heroStatus.textContent =
      allCohorts.length === 1
        ? 'Applications are open for our current cohort'
        : 'Applications are open for ' + allCohorts.length + ' current cohorts';
    heroStatus.setAttribute('data-state', 'open');

    allCohorts.forEach(function (entry) {
      var row = el('div', 'cohort-row');
      var left = el('div');
      left.appendChild(el('h3', null, entry.fellowship.title + ' — ' + entry.cohort.name));
      left.appendChild(
        el(
          'p',
          null,
          formatDate(entry.cohort.startsAt) +
            ' – ' +
            formatDate(entry.cohort.endsAt) +
            ' · capacity ' +
            entry.cohort.capacity,
        ),
      );
      row.appendChild(left);
      row.appendChild(el('span', 'cohort-row__badge', 'Applications open'));
      cohortPanel.appendChild(row);
    });
  }

  function populateCohortSelect(fellowships) {
    cohortSelect.innerHTML = '';
    var allCohorts = [];
    fellowships.forEach(function (f) {
      f.cohorts.forEach(function (c) {
        allCohorts.push({ fellowship: f, cohort: c });
      });
    });

    if (allCohorts.length === 0) {
      var opt = el('option', null, 'No cohort is currently accepting applications');
      opt.value = '';
      opt.disabled = true;
      opt.selected = true;
      cohortSelect.appendChild(opt);
      cohortSelect.disabled = true;
      document.getElementById('submit-button').disabled = true;
      return;
    }

    var placeholder = el('option', null, 'Choose a cohort…');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    cohortSelect.appendChild(placeholder);

    allCohorts.forEach(function (entry) {
      var option = el(
        'option',
        null,
        entry.fellowship.title +
          ' — ' +
          entry.cohort.name +
          ' (starts ' +
          formatDate(entry.cohort.startsAt) +
          ')',
      );
      option.value = entry.cohort.id;
      option.dataset.fellowshipId = entry.fellowship.id;
      cohortSelect.appendChild(option);
    });
  }

  function populateTrackSelectFor(fellowshipId) {
    trackSelect.innerHTML = '';
    var noPreference = el('option', null, 'No preference');
    noPreference.value = '';
    trackSelect.appendChild(noPreference);

    var fellowship = catalog.filter(function (f) {
      return f.id === fellowshipId;
    })[0];
    if (!fellowship) return;

    fellowship.tracks.forEach(function (track) {
      var option = el(
        'option',
        null,
        track.name + ' (' + (DIFFICULTY_LABEL[track.difficulty] || track.difficulty) + ')',
      );
      option.value = track.id;
      trackSelect.appendChild(option);
    });
  }

  cohortSelect.addEventListener('change', function () {
    var selected = cohortSelect.options[cohortSelect.selectedIndex];
    populateTrackSelectFor(selected ? selected.dataset.fellowshipId : null);
  });

  fetch(API_BASE_URL + '/public/fellowships')
    .then(function (response) {
      if (!response.ok) throw new Error('Could not load the catalogue.');
      return response.json();
    })
    .then(function (payload) {
      catalog = payload.data || [];
      renderTracks(catalog);
      renderCohorts(catalog);
      populateCohortSelect(catalog);
    })
    .catch(function () {
      heroStatus.textContent = 'Cohort status is temporarily unavailable';
      heroStatus.setAttribute('data-state', 'closed');
      trackGrid.innerHTML = '';
      trackGrid.appendChild(
        el('p', 'muted', 'Tracks are temporarily unavailable — please try again shortly.'),
      );
      cohortPanel.innerHTML = '';
      cohortPanel.appendChild(
        el('p', 'muted', 'We could not load cohort status right now — please try again shortly.'),
      );
    });

  /* ---------------- application form ---------------- */

  var form = document.getElementById('apply-form');
  var statusEl = document.getElementById('form-status');
  var submitButton = document.getElementById('submit-button');

  var ERROR_MESSAGES = {
    REGISTRATION_CLOSED:
      'Applications are temporarily closed platform-wide. Please check back soon.',
    APPLICATION_ALREADY_PENDING: 'You already have a pending application for this cohort.',
  };

  function setStatus(message, tone) {
    statusEl.textContent = message;
    statusEl.setAttribute('data-tone', tone || '');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('', '');

    var displayName = document.getElementById('displayName').value.trim();
    var email = document.getElementById('email').value.trim();
    var cohortId = cohortSelect.value;
    var trackId = trackSelect.value;
    var note = document.getElementById('note').value.trim();

    if (!displayName || !email || !cohortId) {
      setStatus('Please fill in your name, email, and choose a cohort.', 'error');
      return;
    }

    var body = {
      cohortId: cohortId,
      prospectEmail: email,
      prospectDisplayName: displayName,
    };
    if (trackId) body.requestedLearningTrackId = trackId;
    if (note) body.note = note;

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';

    fetch(API_BASE_URL + '/public/cohort-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          var code = result.payload && result.payload.error && result.payload.error.code;
          var message =
            (code && ERROR_MESSAGES[code]) ||
            (result.payload && result.payload.error && result.payload.error.message) ||
            'Something went wrong submitting your application. Please try again.';
          throw new Error(message);
        }
        form.reset();
        cohortSelect.disabled = true;
        submitButton.hidden = true;
        setStatus(
          'Application received — an administrator will review it and reach out to ' +
            email +
            ' with next steps.',
          'success',
        );
      })
      .catch(function (error) {
        setStatus(error.message, 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Submit application';
      });
  });
})();
