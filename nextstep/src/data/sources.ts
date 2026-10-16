// Hand-checked facts and official links. Every entry here was read on the date in CHECKED_ON, either on the
// National Careers Service (NCS) job profile for the role or on the regulator / GOV.UK page that is linked.
// If you add an entry, check it against a real source first and keep the link next to it.

export const CHECKED_ON = '16 October 2026';

export interface Verified {
  text: string;
  source: string;
  url: string;
}

const NCS = (slug: string) => `https://nationalcareers.service.gov.uk/job-profiles/${slug}`;
export const ncsUrl = NCS;

/** Legal or regulatory requirements confirmed on an official source. */
export const VERIFIED: Record<string, Verified[]> = {
  nurse: [
    {
      text: 'You need a degree (or degree apprenticeship) approved by the Nursing and Midwifery Council (NMC) and must join the NMC register to work as a registered nurse.',
      source: 'NCS job profile and NMC',
      url: 'https://www.nmc.org.uk/registration/joining-the-register/'
    }
  ],
  'mental-health-nurse': [
    {
      text: 'You need an NMC-approved mental health nursing degree (or degree apprenticeship) and must join the NMC register to work as a registered nurse.',
      source: 'NCS job profile and NMC',
      url: 'https://www.nmc.org.uk/registration/joining-the-register/'
    }
  ],
  'nursing-associate': [
    {
      text: 'Nursing associates train on a programme approved by the Nursing and Midwifery Council and register with the NMC.',
      source: 'NCS job profile and NMC',
      url: 'https://www.nmc.org.uk/registration/joining-the-register/'
    }
  ],
  paramedic: [
    {
      text: '“Paramedic” is a protected title. You must be registered with the Health and Care Professions Council (HCPC) to use it, usually after an HCPC-approved course.',
      source: 'HCPC – professions and protected titles',
      url: 'https://www.hcpc-uk.org/about-us/who-we-regulate/the-professions/'
    }
  ],
  physiotherapist: [
    {
      text: '“Physiotherapist” is a protected title. You must be registered with the HCPC, usually after an HCPC-approved degree.',
      source: 'HCPC – professions and protected titles',
      url: 'https://www.hcpc-uk.org/about-us/who-we-regulate/the-professions/'
    }
  ],
  'occupational-therapist': [
    {
      text: '“Occupational therapist” is a protected title. You must be registered with the HCPC, usually after an HCPC-approved degree.',
      source: 'HCPC – professions and protected titles',
      url: 'https://www.hcpc-uk.org/about-us/who-we-regulate/the-professions/'
    }
  ],
  'social-worker': [
    {
      text: 'In England you need a social work qualification approved by Social Work England and must register with Social Work England to practise.',
      source: 'NCS job profile',
      url: NCS('social-worker')
    }
  ],
  'pharmacy-technician': [
    {
      text: 'Pharmacy technicians in Great Britain must register with the General Pharmaceutical Council (GPhC) after completing approved training.',
      source: 'NCS job profile',
      url: NCS('pharmacy-technician')
    }
  ],
  'primary-school-teacher': [
    {
      text: 'You will usually need qualified teacher status (QTS) to teach in a state school in England.',
      source: 'NCS job profile and Get Into Teaching',
      url: 'https://getintoteaching.education.gov.uk/'
    }
  ],
  'secondary-school-teacher': [
    {
      text: 'You will usually need qualified teacher status (QTS) to teach in a state school in England.',
      source: 'NCS job profile and Get Into Teaching',
      url: 'https://getintoteaching.education.gov.uk/'
    }
  ],
  'financial-adviser': [
    {
      text: 'To give regulated financial advice you need a level 4 qualification in financial advice recognised by the Financial Conduct Authority (FCA).',
      source: 'NCS job profile and FCA training and competence rules',
      url: 'https://www.fca.org.uk/firms/training-competence'
    }
  ],
  'mortgage-adviser': [
    {
      text: 'You need a mortgage advice qualification recognised by the Financial Conduct Authority (FCA), and must be registered as an FCA “approved person”.',
      source: 'NCS job profile',
      url: NCS('mortgage-adviser')
    }
  ],
  plumber: [
    {
      text: 'You must be on the Gas Safe Register to work on domestic gas heating systems.',
      source: 'NCS job profile',
      url: NCS('plumber')
    }
  ],
  'building-control-officer': [
    {
      text: 'You need to register with the Building Safety Regulator to carry out building control tasks.',
      source: 'NCS job profile',
      url: NCS('building-control-officer')
    }
  ],
  'large-goods-vehicle-driver': [
    {
      text: 'You need to be over 18, hold a lorry (category C or C+E) licence and have a Driver Certificate of Professional Competence (Driver CPC).',
      source: 'NCS job profile and GOV.UK',
      url: 'https://www.gov.uk/become-lorry-bus-driver'
    }
  ],
  'road-transport-manager': [
    {
      text: 'You need a Transport Manager Certificate of Professional Competence (CPC) to be the transport manager for a road haulage or passenger transport operator.',
      source: 'NCS job profile',
      url: NCS('road-transport-manager')
    }
  ],
  'forklift-driver': [
    {
      text: 'There is no official forklift “licence”. Employers expect a training completion certificate, which some job adverts call a licence.',
      source: 'NCS job profile',
      url: NCS('forklift-driver')
    }
  ],
  'domestic-energy-assessor': [
    {
      text: 'You must hold the relevant certificate and be registered with an accreditation scheme to carry out energy assessments.',
      source: 'NCS job profile',
      url: NCS('domestic-energy-assessor')
    }
  ]
};

export interface Link {
  label: string;
  url: string;
  note?: string;
}

/** Official sites used for further-education and self-employment pathways (all checked). */
export const LINKS = {
  ncsHome: { label: 'National Careers Service', url: 'https://nationalcareers.service.gov.uk/' },
  ncsAdvice: { label: 'Talk to a careers adviser (National Careers Service)', url: 'https://nationalcareers.service.gov.uk/help-and-support' },
  ncsSkills: { label: 'NCS skills assessment', url: 'https://nationalcareers.service.gov.uk/discover-your-skills-and-careers' },
  apprenticeships: { label: 'Find an apprenticeship (GOV.UK)', url: 'https://www.gov.uk/apply-apprenticeship' },
  apprenticeshipsInfo: { label: 'Apprenticeships (GOV.UK)', url: 'https://www.apprenticeships.gov.uk/' },
  standards: { label: 'Apprenticeship standards (Skills England)', url: 'https://skillsengland.education.gov.uk/apprenticeships/' },
  feCourses: { label: 'Further education courses and funding (GOV.UK)', url: 'https://www.gov.uk/further-education-courses' },
  heCourses: { label: 'Find and apply for higher education courses (GOV.UK)', url: 'https://www.gov.uk/higher-education-courses-find-and-apply' },
  ucas: { label: 'UCAS', url: 'https://www.ucas.com/' },
  accessHe: { label: 'Access to Higher Education Diploma', url: 'https://www.accesstohe.ac.uk/' },
  tlevels: { label: 'T Levels', url: 'https://www.tlevels.gov.uk/' },
  levels: { label: 'What qualification levels mean (GOV.UK)', url: 'https://www.gov.uk/what-different-qualification-levels-mean/list-of-qualification-levels' },
  setUpBusiness: { label: 'Set up a business (GOV.UK)', url: 'https://www.gov.uk/set-up-business' },
  selfEmployed: { label: 'Working for yourself (GOV.UK)', url: 'https://www.gov.uk/working-for-yourself' },
  findJob: { label: 'Find a job (GOV.UK)', url: 'https://www.gov.uk/find-a-job' },
  volunteering: { label: 'Volunteering (GOV.UK)', url: 'https://www.gov.uk/volunteering' },
  healthCareers: { label: 'NHS Health Careers', url: 'https://www.healthcareers.nhs.uk/' },
  teaching: { label: 'Get Into Teaching', url: 'https://getintoteaching.education.gov.uk/' },
  scotland: { label: 'My World of Work (Scotland)', url: 'https://www.myworldofwork.co.uk/' },
  wales: { label: 'Careers Wales', url: 'https://careerswales.gov.wales/' },
  ni: { label: 'nidirect careers (Northern Ireland)', url: 'https://www.nidirect.gov.uk/campaigns/careers' }
} satisfies Record<string, Link>;
