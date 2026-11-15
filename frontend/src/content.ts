export const brand = {
  name: 'AstroCare',
  wordmark: 'ASTROCARE',
  email: 'crew@astrocare.space',
};

export const nav = [
  {label: 'Delay', href: '#trajectory'},
  {label: 'Launch', href: '#launch'},
];

export const hero = {
  title: 'ASTROCARE',
  kicker: 'Earth-independent crew health',
  site: 'Jezero Crater · 18.38°N 77.58°E',
};

export const trajectory = {
  eyebrow: 'The long silence',
  heading: 'Earth answers later.',
  legs: [
    {day: 'Day 0', title: 'Parking orbit', body: 'Crew and craft are checked while Earth is still a one-second call away.'},
    {day: 'Day 0', title: 'Trans-Mars injection', body: 'The burn that commits the crew. Replies from Earth start slipping from seconds to minutes.'},
    {day: 'Day 210', title: 'Mars orbit insertion', body: 'Behind the planet, out of contact. Capture, then a delay measured in tens of minutes.'},
    {day: 'Day 215', title: 'Descent to Jezero', body: 'Round-trip answers take about 44 minutes. The crew decides first, Earth reviews later.'},
  ],
};

export const levels = [
  {n: 0, label: 'Ground-led', note: 'Earth decides, crew executes'},
  {n: 1, label: 'Telemedicine', note: 'Live consult is still practical'},
  {n: 2, label: 'Async consult', note: 'Messages queue, crew acts safely meanwhile'},
  {n: 3, label: 'Onboard-first', note: 'AI triage decides first, Earth reviews after'},
];
