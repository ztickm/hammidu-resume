/**
 * The sections createResumeForm() renders, described once here.
 *
 * A field's `type` says how its control maps onto the JSON:
 *   text / textarea → string            lines → string[], one per line
 *   date            → ISO8601 string    tags  → string[], comma separated
 */

const RF_DEGREES = ['Bachelor', 'Master', 'PhD', 'Associate', 'Diploma', 'Certificate'];
const RF_FLUENCY = ['Native speaker', 'Fluent', 'Professional working', 'Intermediate', 'Elementary'];
const RF_LEVELS  = ['Expert', 'Advanced', 'Intermediate', 'Beginner'];

// `path` is where the section lives in the resume; `itemTitle`/`itemSub` build the
// one-line summary a collapsed entry shows, and `blank` stands in while it's empty.
const RF_SECTIONS = [
  {
    path: 'basics', icon: '👤', title: 'Basics', kind: 'object',
    fields: [
      { key: 'name',                 label: 'Full name', ph: 'Jane Doe', half: true },
      { key: 'label',                label: 'Professional title', ph: 'Software Engineer', half: true },
      { key: 'email',                label: 'Email', ph: 'jane@example.com', half: true },
      { key: 'phone',                label: 'Phone', ph: '+1 (555) 123-4567', half: true },
      { key: 'url',                  label: 'Website', hint: 'include https://', ph: 'https://janedoe.dev', half: true },
      { key: 'location.city',        label: 'City', ph: 'Berlin', half: true },
      { key: 'location.region',      label: 'Region / state', ph: 'Berlin', half: true },
      { key: 'location.countryCode', label: 'Country code', hint: 'two letters', ph: 'DE', half: true },
      { key: 'summary',              label: 'Professional summary', type: 'textarea', rows: 4,
        ph: 'Briefly describe your background and expertise…' },
    ],
  },
  {
    path: 'basics.profiles', icon: '🔗', title: 'Profiles & Links', kind: 'array',
    add: 'Add profile', blank: 'New profile',
    itemTitle: (p) => p.network || p.username || '',
    itemSub:   (p) => (p.network && p.username ? p.username : ''),
    fields: [
      { key: 'network',  label: 'Network', ph: 'GitHub', half: true },
      { key: 'username', label: 'Username', hint: 'or paste the full URL', ph: 'janedoe', half: true },
      { key: 'url',      label: 'URL', hint: 'filled in from the username for known networks', ph: 'https://github.com/janedoe' },
    ],
  },
  {
    path: 'work', icon: '💼', title: 'Work Experience', kind: 'array',
    add: 'Add position', blank: 'New position',
    itemTitle: (w) => [w.position, w.name].filter(Boolean).join(' — '),
    itemSub:   (w) => rfDates(w.startDate, w.endDate),
    fields: [
      { key: 'position',   label: 'Position', ph: 'Senior Software Engineer', half: true },
      { key: 'name',       label: 'Company', ph: 'Acme Corp', half: true },
      { key: 'startDate',  label: 'Start date', type: 'date', half: true },
      { key: 'endDate',    label: 'End date', type: 'date', hint: 'blank = present', half: true },
      { key: 'location',   label: 'Location', ph: 'Berlin, DE', half: true },
      { key: 'url',        label: 'Company URL', ph: 'https://acme.com', half: true },
      { key: 'summary',    label: 'Role summary', type: 'textarea', rows: 2, ph: 'What the role was about' },
      { key: 'highlights', label: 'Highlights', type: 'lines', rows: 4, hint: 'one per line',
        ph: 'Cut page load time by 40%\nLed a team of five engineers' },
    ],
  },
  {
    path: 'education', icon: '🎓', title: 'Education', kind: 'array',
    add: 'Add education', blank: 'New entry',
    itemTitle: (e) => [e.studyType, e.area].filter(Boolean).join(' in ') || e.institution || '',
    itemSub:   (e) => rfDates(e.startDate, e.endDate),
    fields: [
      { key: 'institution', label: 'Institution', ph: 'TU Berlin', half: true },
      { key: 'area',        label: 'Field of study', ph: 'Computer Science', half: true },
      { key: 'studyType',   label: 'Degree', suggest: RF_DEGREES, ph: 'Bachelor', half: true },
      { key: 'score',       label: 'Grade / score', ph: '1.3', half: true },
      { key: 'startDate',   label: 'Start date', type: 'date', half: true },
      { key: 'endDate',     label: 'End date', type: 'date', half: true },
      { key: 'url',         label: 'Institution URL', ph: 'https://www.tu.berlin' },
      { key: 'courses',     label: 'Courses', type: 'lines', rows: 3, hint: 'one per line' },
    ],
  },
  {
    path: 'skills', icon: '🛠', title: 'Skills', kind: 'array',
    add: 'Add skill group', blank: 'New skill group',
    itemTitle: (s) => s.name || '',
    itemSub:   (s) => (s.keywords?.length ? `${s.keywords.length} keywords` : ''),
    fields: [
      { key: 'name',     label: 'Group name', ph: 'Languages', half: true },
      { key: 'level',    label: 'Level', suggest: RF_LEVELS, ph: 'Advanced', half: true },
      { key: 'keywords', label: 'Keywords', type: 'tags', hint: 'comma separated', ph: 'TypeScript, Python, Go' },
    ],
  },
  {
    path: 'projects', icon: '🚀', title: 'Projects', kind: 'array',
    add: 'Add project', blank: 'New project',
    itemTitle: (p) => p.name || '',
    itemSub:   (p) => rfDates(p.startDate, p.endDate),
    fields: [
      { key: 'name',        label: 'Name', ph: 'Flouka Studio', half: true },
      { key: 'entity',      label: 'Entity', hint: 'who it was for', ph: 'Side project', half: true },
      { key: 'startDate',   label: 'Start date', type: 'date', half: true },
      { key: 'endDate',     label: 'End date', type: 'date', half: true },
      { key: 'url',         label: 'URL', ph: 'https://github.com/you/project', half: true },
      { key: 'type',        label: 'Type', ph: 'application', half: true },
      { key: 'description', label: 'Description', type: 'textarea', rows: 2 },
      { key: 'roles',       label: 'Roles', type: 'tags', hint: 'comma separated', ph: 'Author, Maintainer' },
      { key: 'keywords',    label: 'Keywords', type: 'tags', hint: 'comma separated', ph: 'Bun, TypeScript' },
      { key: 'highlights',  label: 'Highlights', type: 'lines', rows: 3, hint: 'one per line' },
    ],
  },
  {
    path: 'volunteer', icon: '🤝', title: 'Volunteer', kind: 'array',
    add: 'Add volunteer role', blank: 'New role',
    itemTitle: (v) => [v.position, v.organization].filter(Boolean).join(' — '),
    itemSub:   (v) => rfDates(v.startDate, v.endDate),
    fields: [
      { key: 'organization', label: 'Organization', ph: 'Red Cross', half: true },
      { key: 'position',     label: 'Position', ph: 'Volunteer Coordinator', half: true },
      { key: 'startDate',    label: 'Start date', type: 'date', half: true },
      { key: 'endDate',      label: 'End date', type: 'date', half: true },
      { key: 'url',          label: 'URL', ph: 'https://www.redcross.org' },
      { key: 'summary',      label: 'Summary', type: 'textarea', rows: 2 },
      { key: 'highlights',   label: 'Highlights', type: 'lines', rows: 3, hint: 'one per line' },
    ],
  },
  {
    path: 'languages', icon: '🌍', title: 'Languages', kind: 'array',
    add: 'Add language', blank: 'New language',
    itemTitle: (l) => l.language || '',
    itemSub:   (l) => l.fluency || '',
    fields: [
      { key: 'language', label: 'Language', ph: 'German', half: true },
      { key: 'fluency',  label: 'Fluency', suggest: RF_FLUENCY, ph: 'Fluent', half: true },
    ],
  },
  {
    path: 'awards', icon: '🏆', title: 'Awards', kind: 'array',
    add: 'Add award', blank: 'New award',
    itemTitle: (a) => a.title || '',
    itemSub:   (a) => a.date || '',
    fields: [
      { key: 'title',   label: 'Title', ph: 'Employee of the Year', half: true },
      { key: 'awarder', label: 'Awarder', ph: 'Acme Corp', half: true },
      { key: 'date',    label: 'Date', type: 'date', half: true },
      { key: 'summary', label: 'Summary', type: 'textarea', rows: 2 },
    ],
  },
  {
    path: 'certificates', icon: '📜', title: 'Certificates', kind: 'array',
    add: 'Add certificate', blank: 'New certificate',
    itemTitle: (c) => c.name || '',
    itemSub:   (c) => c.date || '',
    fields: [
      { key: 'name',   label: 'Name', ph: 'AWS Solutions Architect', half: true },
      { key: 'issuer', label: 'Issuer', ph: 'Amazon Web Services', half: true },
      { key: 'date',   label: 'Date', type: 'date', half: true },
      { key: 'url',    label: 'URL', ph: 'https://www.credly.com/badges/…', half: true },
    ],
  },
  {
    path: 'publications', icon: '📚', title: 'Publications', kind: 'array',
    add: 'Add publication', blank: 'New publication',
    itemTitle: (p) => p.name || '',
    itemSub:   (p) => p.releaseDate || '',
    fields: [
      { key: 'name',        label: 'Title', ph: 'On Resume Parsing', half: true },
      { key: 'publisher',   label: 'Publisher', ph: 'ACM', half: true },
      { key: 'releaseDate', label: 'Release date', type: 'date', half: true },
      { key: 'url',         label: 'URL', ph: 'https://doi.org/…', half: true },
      { key: 'summary',     label: 'Summary', type: 'textarea', rows: 2 },
    ],
  },
  {
    path: 'interests', icon: '🎯', title: 'Interests', kind: 'array',
    add: 'Add interest', blank: 'New interest',
    itemTitle: (i) => i.name || '',
    itemSub:   (i) => (i.keywords?.length ? `${i.keywords.length} keywords` : ''),
    fields: [
      { key: 'name',     label: 'Name', ph: 'Open source', half: true },
      { key: 'keywords', label: 'Keywords', type: 'tags', hint: 'comma separated', half: true },
    ],
  },
  {
    path: 'references', icon: '💬', title: 'References', kind: 'array',
    add: 'Add reference', blank: 'New reference',
    itemTitle: (r) => r.name || '',
    fields: [
      { key: 'name',      label: 'Name', ph: 'Jane Smith — CTO, Acme Corp' },
      { key: 'reference', label: 'Reference', type: 'textarea', rows: 3 },
    ],
  },
];

// Bare usernames are what people type, but the template only renders a link when
// the profile carries a URL — so derive one for the networks we recognise.
const RF_PROFILE_URLS = {
  github:        'https://github.com/',
  gitlab:        'https://gitlab.com/',
  linkedin:      'https://www.linkedin.com/in/',
  x:             'https://x.com/',
  twitter:       'https://x.com/',
  stackoverflow: 'https://stackoverflow.com/users/',
  dribbble:      'https://dribbble.com/',
  behance:       'https://www.behance.net/',
  medium:        'https://medium.com/@',
  youtube:       'https://www.youtube.com/@',
  instagram:     'https://www.instagram.com/',
};
