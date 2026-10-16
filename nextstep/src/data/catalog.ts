// NextStep's own curation layer on top of the National Careers Service (NCS) job profiles in ncs.json.
//
// For every career this adds: the sector it is grouped under, a rough seniority level, interest tags used for
// matching, extra search keywords, and the progression links used to build pathways:
//   up   – roles this one commonly leads to with experience or further training (taken from each NCS
//          "Career path and progression" section wherever the target role is in this dataset)
//   side – related roles at a similar level that use overlapping skills
// These links are NextStep's editorial judgement, informed by NCS. They are shown in the app as
// illustrative routes, never as guaranteed promotions.

export type Sector =
  | 'manufacturing'
  | 'construction'
  | 'engineering'
  | 'digital'
  | 'health'
  | 'business'
  | 'finance'
  | 'retail'
  | 'hospitality'
  | 'education'
  | 'transport'
  | 'public'
  | 'creative'
  | 'sport';

/** Interest / work-style tags used by the pathway engine and the discovery questionnaire. */
export type Tag =
  | 'people' // works closely with customers, patients, learners or the public
  | 'team' // works mainly within a team
  | 'solo' // works independently a lot of the time
  | 'hands' // practical, hands-on
  | 'desk' // mainly desk or computer based
  | 'creative'
  | 'analytical'
  | 'lead' // leading people or operations
  | 'tech' // technology heavy
  | 'care' // helping or supporting people directly
  | 'business' // commercial, sales or enterprise focus
  | 'active' // physically active
  | 'workshop' // workshop, factory or plant
  | 'site' // building sites, outdoors, other people's homes
  | 'office'
  | 'clinical' // hospital, care home, surgery or pharmacy
  | 'venue' // shop, restaurant, hotel, gym
  | 'classroom' // school, college or training centre
  | 'road'; // driving or travelling

/** 1 entry level · 2 skilled / qualified · 3 senior, technical or supervisory · 4 professional or manager · 5 senior manager */
export type Level = 1 | 2 | 3 | 4 | 5;

export interface CatalogEntry {
  sector: Sector;
  level: Level;
  tags: Tag[];
  /** extra words people might type for this job, course or apprenticeship */
  kw?: string[];
  up?: string[];
  side?: string[];
}

const e = (sector: Sector, level: Level, tags: string, opts: { kw?: string; up?: string; side?: string } = {}): CatalogEntry => ({
  sector,
  level,
  tags: tags.split(' ') as Tag[],
  kw: opts.kw ? opts.kw.split(',').map((s) => s.trim()) : [],
  up: opts.up ? opts.up.split(' ') : [],
  side: opts.side ? opts.side.split(' ') : []
});

export const CATALOG: Record<string, CatalogEntry> = {
  // ── Manufacturing & boatbuilding ──────────────────────────────────────────
  'boat-builder': e('manufacturing', 2, 'hands creative team workshop', {
    kw: 'boatbuilder, boatbuilding, boat building, shipwright, marine craftsperson, laminator, laminating, fibreglass, grp, composites, gelcoat, yacht, superyacht, sunseeker, marine fit out, boat fitter',
    up: 'marine-engineering-technician supervisor',
    side: 'wood-machinist furniture-maker paint-sprayer quality-control-assistant cad-technician carpenter'
  }),
  'marine-engineering-technician': e('manufacturing', 3, 'hands tech team workshop', {
    kw: 'marine engineering, marine technician, marine electrician, marine fitter, maritime fitter, shipbuilding',
    up: 'marine-engineer supervisor',
    side: 'boat-builder mechanical-engineering-technician engineering-maintenance-technician welder'
  }),
  'marine-engineer': e('manufacturing', 4, 'analytical tech team', {
    kw: 'naval architect, marine engineering degree',
    up: 'business-project-manager production-manager-manufacturing-',
    side: 'mechanical-engineer design-and-development-engineer electrical-engineer'
  }),
  'production-worker-manufacturing': e('manufacturing', 1, 'hands team workshop active', {
    kw: 'production operative, process operative, factory worker, assembly, assembler, assembly operative, line worker, manufacturing operative, packer',
    up: 'supervisor quality-control-assistant',
    side: 'engineering-operative food-factory-worker forklift-driver warehouse-worker'
  }),
  'cnc-machinist': e('manufacturing', 2, 'hands tech workshop solo', {
    kw: 'cnc, cnc operator, cnc programmer, machinist, machine operator, lathe, miller, toolmaker',
    up: 'supervisor production-manager-manufacturing-',
    side: 'wood-machinist quality-control-assistant cad-technician engineering-operative'
  }),
  'wood-machinist': e('manufacturing', 2, 'hands workshop solo', {
    kw: 'wood machining, woodworking machinist, mill shop, sawyer',
    up: 'supervisor',
    side: 'carpenter furniture-maker cnc-machinist shopfitter'
  }),
  'furniture-maker': e('manufacturing', 2, 'hands creative workshop solo', {
    kw: 'cabinet maker, cabinetmaker, upholsterer, upholstery, furniture, bench joinery, furniture manufacturing',
    up: 'supervisor',
    side: 'wood-machinist carpenter interior-designer product-designer'
  }),
  'paint-sprayer': e('manufacturing', 2, 'hands workshop', {
    kw: 'sprayer, spray painter, paint technician, refinisher, vehicle paint, finisher, polisher, paint finishing',
    up: 'supervisor quality-control-assistant',
    side: 'painter-and-decorator boat-builder'
  }),
  'quality-control-assistant': e('manufacturing', 3, 'analytical workshop desk', {
    kw: 'quality inspector, quality control, quality assurance, qa, qc, inspector, quality technician, quality engineer',
    up: 'production-manager-manufacturing-',
    side: 'health-and-safety-adviser business-analyst business-project-manager'
  }),
  supervisor: e('business', 3, 'lead people team', {
    kw: 'team leader, chargehand, charge hand, foreman, forewoman, first line manager, shift leader, shift supervisor, line leader, team manager, cell leader',
    up: 'production-manager-manufacturing- office-manager warehouse-manager retail-manager customer-services-manager construction-manager restaurant-manager',
    side: 'training-officer human-resources-officer health-and-safety-adviser'
  }),
  'production-manager-manufacturing-': e('manufacturing', 4, 'lead business analytical workshop', {
    kw: 'operations manager, plant manager, production manager, manufacturing manager, factory manager, works manager',
    side: 'supply-chain-manager purchasing-manager business-project-manager health-and-safety-adviser'
  }),
  'health-and-safety-adviser': e('manufacturing', 4, 'analytical people site office', {
    kw: 'health and safety, hse, safety officer, safety advisor, nebosh, she advisor',
    side: 'facilities-manager building-control-officer training-officer'
  }),
  'manufacturing-systems-engineer': e('engineering', 4, 'analytical tech workshop', {
    kw: 'manufacturing engineer, process engineer, production engineer, continuous improvement, lean, industrial engineer',
    up: 'production-manager-manufacturing-',
    side: 'robotics-engineer design-and-development-engineer mechanical-engineer'
  }),
  'food-factory-worker': e('manufacturing', 1, 'hands team workshop active', {
    kw: 'food production, food process operative, food manufacturing, bakery operative',
    up: 'supervisor quality-control-assistant',
    side: 'production-worker-manufacturing warehouse-worker kitchen-assistant'
  }),

  // ── Construction & trades ─────────────────────────────────────────────────
  carpenter: e('construction', 2, 'hands creative site active', {
    kw: 'joiner, carpentry, joinery, carpentry and joinery, site carpenter, bench joiner, chippy, wood occupations, trowel occupations',
    up: 'construction-site-supervisor construction-manager',
    side: 'shopfitter kitchen-and-bathroom-fitter furniture-maker wood-machinist estimator boat-builder'
  }),
  bricklayer: e('construction', 2, 'hands site active', {
    kw: 'brickie, bricklaying, brickwork, mason, stonemason',
    up: 'construction-site-supervisor',
    side: 'estimator plasterer roofer'
  }),
  plumber: e('construction', 2, 'hands site solo', {
    kw: 'plumbing, plumbing and heating, heating engineer, gas engineer',
    up: 'construction-site-supervisor',
    side: 'heat-pump-engineer kitchen-and-bathroom-fitter estimator'
  }),
  electrician: e('construction', 2, 'hands tech site', {
    kw: 'electrical installation, electrical installer, sparky, electrotechnical, installation electrician, maintenance electrician, electrical apprentice',
    up: 'electrical-engineering-technician construction-site-supervisor',
    side: 'heat-pump-engineer estimator engineering-maintenance-technician'
  }),
  'painter-and-decorator': e('construction', 2, 'hands creative site', {
    kw: 'painter, decorator, painting and decorating',
    up: 'construction-site-supervisor',
    side: 'plasterer interior-designer estimator paint-sprayer'
  }),
  plasterer: e('construction', 2, 'hands site active', {
    kw: 'plastering, dry liner, dry lining, renderer',
    up: 'construction-site-supervisor',
    side: 'painter-and-decorator estimator'
  }),
  roofer: e('construction', 2, 'hands site active', {
    kw: 'roofing, slater, flat roofer, tiler roof',
    up: 'construction-site-supervisor',
    side: 'scaffolder estimator'
  }),
  'kitchen-and-bathroom-fitter': e('construction', 2, 'hands site solo', {
    kw: 'kitchen fitter, bathroom fitter, fitter, installer',
    up: 'construction-site-supervisor',
    side: 'carpenter plumber shopfitter interior-designer'
  }),
  shopfitter: e('construction', 2, 'hands site team', {
    kw: 'shop fitting, shopfitting, interior fit out, fit-out',
    up: 'construction-site-supervisor construction-contracts-manager',
    side: 'carpenter kitchen-and-bathroom-fitter'
  }),
  scaffolder: e('construction', 2, 'hands site active team', {
    kw: 'scaffolding',
    up: 'construction-site-supervisor',
    side: 'roofer health-and-safety-adviser'
  }),
  'heat-pump-engineer': e('construction', 3, 'hands tech site solo', {
    kw: 'heat pump, renewable heating, low carbon heating, air source, ground source, green energy installer',
    up: 'construction-site-supervisor',
    side: 'plumber electrician domestic-energy-assessor'
  }),
  'domestic-energy-assessor': e('construction', 2, 'analytical solo site', {
    kw: 'energy assessor, epc, retrofit assessor',
    side: 'building-surveyor heat-pump-engineer'
  }),
  'construction-site-supervisor': e('construction', 3, 'lead site people', {
    kw: 'site supervisor, clerk of works, site foreman, assistant site manager, site agent, smsts, sssts',
    up: 'construction-manager',
    side: 'health-and-safety-adviser estimator building-control-officer'
  }),
  'construction-manager': e('construction', 4, 'lead business site', {
    kw: 'site manager, construction project manager, project manager construction, building manager',
    up: 'construction-contracts-manager',
    side: 'business-project-manager quantity-surveyor facilities-manager'
  }),
  'construction-contracts-manager': e('construction', 5, 'lead business office', {
    kw: 'contracts manager, contract manager',
    side: 'quantity-surveyor business-project-manager'
  }),
  'quantity-surveyor': e('construction', 4, 'analytical desk office business', {
    kw: 'qs, quantity surveying, cost consultant, commercial manager',
    up: 'construction-contracts-manager',
    side: 'estimator building-surveyor purchasing-manager'
  }),
  estimator: e('construction', 3, 'analytical desk office', {
    kw: 'estimating, cost estimator, cost planner, cost engineer, takeoff',
    up: 'quantity-surveyor construction-contracts-manager',
    side: 'purchasing-manager'
  }),
  'building-control-officer': e('construction', 4, 'analytical site solo', {
    kw: 'building inspector, building control, building control surveyor',
    side: 'building-surveyor health-and-safety-adviser'
  }),
  'architectural-technician': e('construction', 3, 'desk creative tech office', {
    kw: 'architectural, architecture, architectural technologist, revit, bim',
    up: 'building-surveyor',
    side: 'cad-technician interior-designer'
  }),
  'building-surveyor': e('construction', 4, 'analytical site office', {
    kw: 'surveyor, surveying, chartered surveyor',
    up: 'construction-manager',
    side: 'building-control-officer quantity-surveyor'
  }),
  'facilities-manager': e('construction', 4, 'lead people business office', {
    kw: 'facilities, estates manager, property manager, maintenance manager, site services',
    side: 'health-and-safety-adviser office-manager construction-manager'
  }),

  // ── Engineering ───────────────────────────────────────────────────────────
  'engineering-operative': e('engineering', 1, 'hands workshop team', {
    kw: 'engineering operative, engineering apprentice, fabrication operative, workshop operative',
    up: 'engineering-maintenance-technician cnc-machinist mechanical-engineering-technician',
    side: 'welder production-worker-manufacturing maintenance-fitter'
  }),
  'engineering-maintenance-technician': e('engineering', 3, 'hands tech workshop', {
    kw: 'maintenance technician, maintenance engineer, multi-skilled engineer, multi skilled, engineering technician, plant maintenance',
    up: 'supervisor mechanical-engineer electrical-engineer',
    side: 'maintenance-fitter electrical-engineering-technician marine-engineering-technician training-officer'
  }),
  'maintenance-fitter': e('engineering', 2, 'hands tech workshop', {
    kw: 'fitter, mechanical fitter, maintenance fitter, millwright, engineering fitter',
    up: 'engineering-maintenance-technician mechanical-engineering-technician',
    side: 'welder engineering-operative'
  }),
  'mechanical-engineering-technician': e('engineering', 3, 'hands tech analytical workshop', {
    kw: 'mechanical engineering, mechanical technician, mechanical apprentice',
    up: 'mechanical-engineer supervisor',
    side: 'cad-technician marine-engineering-technician quality-control-assistant'
  }),
  'mechanical-engineer': e('engineering', 4, 'analytical tech office', {
    kw: 'mechanical engineering degree, engineer',
    up: 'business-project-manager production-manager-manufacturing-',
    side: 'design-and-development-engineer manufacturing-systems-engineer marine-engineer robotics-engineer'
  }),
  'electrical-engineering-technician': e('engineering', 3, 'hands tech analytical workshop', {
    kw: 'electrical technician, electrical engineering, control technician, instrumentation',
    up: 'electrical-engineer supervisor',
    side: 'electrician engineering-maintenance-technician facilities-manager'
  }),
  'electrical-engineer': e('engineering', 4, 'analytical tech office', {
    kw: 'electrical engineering degree, power engineer, electronics',
    up: 'business-project-manager',
    side: 'robotics-engineer mechanical-engineer'
  }),
  'cad-technician': e('engineering', 3, 'desk tech creative office', {
    kw: 'cad, autocad, solidworks, draughtsperson, draughtsman, draftsperson, drafter, technical drawing, design technician, 3d modelling',
    up: 'design-and-development-engineer',
    side: 'architectural-technician product-designer'
  }),
  welder: e('engineering', 2, 'hands workshop active', {
    kw: 'welding, fabricator, fabrication, welder fabricator, mig, tig, boilermaker, metal fabrication, sheet metal',
    up: 'supervisor quality-control-assistant',
    side: 'maintenance-fitter engineering-operative boat-builder'
  }),
  'design-and-development-engineer': e('engineering', 4, 'creative analytical tech office', {
    kw: 'design engineer, development engineer, product development, research engineer',
    up: 'business-project-manager',
    side: 'product-designer mechanical-engineer manufacturing-systems-engineer'
  }),
  'robotics-engineer': e('engineering', 4, 'tech analytical creative', {
    kw: 'robotics, automation, automation engineer, plc, mechatronics, controls engineer',
    side: 'manufacturing-systems-engineer software-developer electrical-engineer'
  }),

  // ── IT & digital ──────────────────────────────────────────────────────────
  'it-support-technician': e('digital', 2, 'tech people desk office', {
    kw: 'it support, helpdesk, help desk, service desk, it technician, first line support, desktop support, computing, ict, it apprentice, information technology',
    up: 'network-engineer it-project-manager',
    side: 'database-administrator it-security-co-ordinator web-developer'
  }),
  'network-engineer': e('digital', 3, 'tech analytical solo', {
    kw: 'network, networking, network administrator, infrastructure engineer, ccna, systems administrator',
    up: 'it-project-manager',
    side: 'it-security-co-ordinator database-administrator'
  }),
  'software-developer': e('digital', 4, 'tech analytical creative desk', {
    kw: 'programmer, coder, coding, software engineer, developer, programming, computer science, app developer',
    up: 'it-project-manager digital-delivery-manager',
    side: 'web-developer data-analyst-statistician robotics-engineer ux-designer'
  }),
  'web-developer': e('digital', 3, 'tech creative desk', {
    kw: 'web development, front end, frontend, back end, full stack, website developer, web design',
    up: 'software-developer digital-delivery-manager',
    side: 'ux-designer e-commerce-manager graphic-designer'
  }),
  'data-analyst-statistician': e('digital', 4, 'analytical tech desk', {
    kw: 'data analyst, data analysis, analytics, statistics, statistician, data science, excel, power bi, reporting analyst, maths',
    side: 'business-analyst database-administrator software-developer'
  }),
  'database-administrator': e('digital', 3, 'tech analytical desk solo', {
    kw: 'database, dba, sql, data engineer',
    up: 'it-project-manager',
    side: 'data-analyst-statistician network-engineer'
  }),
  'it-project-manager': e('digital', 4, 'lead tech business office', {
    kw: 'it project manager, technical project manager, scrum master, agile',
    up: 'digital-delivery-manager',
    side: 'business-project-manager business-analyst'
  }),
  'ux-designer': e('digital', 3, 'creative tech people desk', {
    kw: 'ux, ui, user experience, product designer digital, interaction design, ui designer',
    up: 'digital-delivery-manager',
    side: 'web-developer graphic-designer'
  }),
  'it-security-co-ordinator': e('digital', 4, 'tech analytical desk', {
    kw: 'cyber security, cybersecurity, cyber, information security, infosec, security analyst, penetration tester',
    side: 'network-engineer'
  }),
  'digital-delivery-manager': e('digital', 5, 'lead tech people office', {
    kw: 'delivery manager, product manager, digital manager',
    side: 'it-project-manager business-project-manager'
  }),

  // ── Health & social care ─────────────────────────────────────────────────
  'healthcare-assistant': e('health', 1, 'care people team clinical active', {
    kw: 'hca, healthcare support worker, health care assistant, nursing assistant, clinical support worker, ward assistant, nursing auxiliary, health and social care',
    up: 'nursing-associate nurse',
    side: 'physiotherapy-assistant care-worker emergency-care-assistant pharmacy-assistant'
  }),
  'care-worker': e('health', 1, 'care people solo clinical', {
    kw: 'carer, care assistant, support worker, domiciliary care, home carer, care home, adult social care, social care',
    up: 'senior-care-worker',
    side: 'healthcare-assistant youth-worker'
  }),
  'senior-care-worker': e('health', 2, 'care people lead clinical', {
    kw: 'senior carer, senior care assistant, senior support worker, team leader care',
    up: 'care-home-manager nursing-associate',
    side: 'training-officer'
  }),
  'care-home-manager': e('health', 4, 'lead care business clinical', {
    kw: 'registered manager, care manager, deputy manager care, service manager care',
    up: 'health-service-manager',
    side: 'social-worker'
  }),
  'nursing-associate': e('health', 3, 'care people clinical team', {
    kw: 'trainee nursing associate, tna, assistant practitioner',
    up: 'nurse',
    side: 'mental-health-nurse'
  }),
  nurse: e('health', 4, 'care people analytical clinical team', {
    kw: 'adult nurse, staff nurse, registered nurse, rgn, nursing, student nurse',
    up: 'health-service-manager',
    side: 'mental-health-nurse paramedic'
  }),
  'mental-health-nurse': e('health', 4, 'care people clinical', {
    kw: 'mental health nursing, rmn, psychiatric nurse',
    up: 'health-service-manager',
    side: 'nurse social-worker'
  }),
  paramedic: e('health', 4, 'care people active road clinical', {
    kw: 'ambulance, paramedic science, student paramedic',
    up: 'health-service-manager',
    side: 'nurse'
  }),
  'emergency-care-assistant': e('health', 2, 'care people active road clinical', {
    kw: 'emergency care support worker, ecsw, ambulance technician, emergency medical technician',
    up: 'paramedic',
    side: 'ambulance-care-assistant healthcare-assistant'
  }),
  'ambulance-care-assistant': e('health', 1, 'care people road', {
    kw: 'patient transport, ambulance care',
    up: 'emergency-care-assistant',
    side: 'healthcare-assistant delivery-van-driver'
  }),
  'pharmacy-assistant': e('health', 1, 'people care venue', {
    kw: 'dispensing assistant, pharmacy counter, chemist assistant, medicines counter',
    up: 'pharmacy-technician',
    side: 'healthcare-assistant sales-assistant'
  }),
  'pharmacy-technician': e('health', 3, 'analytical care clinical', {
    kw: 'pharmacy, dispenser',
    side: 'quality-control-assistant'
  }),
  'physiotherapy-assistant': e('health', 2, 'care people active clinical', {
    kw: 'physio assistant, rehabilitation assistant, therapy assistant',
    up: 'physiotherapist',
    side: 'healthcare-assistant personal-trainer'
  }),
  physiotherapist: e('health', 4, 'care people active clinical', {
    kw: 'physio, physiotherapy, sports therapist',
    side: 'occupational-therapist personal-trainer'
  }),
  'occupational-therapist': e('health', 4, 'care people creative clinical', {
    kw: 'occupational therapy, ot',
    side: 'physiotherapist social-worker'
  }),
  'gp-practice-manager': e('health', 4, 'lead business people office', {
    kw: 'practice manager, surgery manager',
    up: 'health-service-manager',
    side: 'office-manager'
  }),
  'health-service-manager': e('health', 5, 'lead business analytical office', {
    kw: 'nhs manager, hospital manager, service manager',
    side: 'care-home-manager'
  }),
  'medical-secretary': e('health', 2, 'desk people office', {
    kw: 'medical administrator, medical receptionist, ward clerk, gp receptionist',
    up: 'gp-practice-manager office-manager',
    side: 'receptionist admin-assistant'
  }),

  // ── Business & administration ─────────────────────────────────────────────
  'admin-assistant': e('business', 1, 'desk people office team', {
    kw: 'administrator, admin, office administrator, administration, business administration, clerk, data entry, office assistant, business admin',
    up: 'office-manager personal-assistant',
    side: 'payroll-administrator human-resources-officer medical-secretary receptionist customer-service-assistant'
  }),
  receptionist: e('business', 1, 'people desk office venue', {
    kw: 'front of house, front desk, reception, hotel receptionist',
    up: 'office-manager personal-assistant',
    side: 'admin-assistant medical-secretary customer-service-assistant'
  }),
  'office-manager': e('business', 3, 'lead people desk office', {
    kw: 'office manager, administration manager, operations coordinator',
    up: 'business-project-manager facilities-manager',
    side: 'personal-assistant human-resources-officer'
  }),
  'personal-assistant': e('business', 3, 'desk people office', {
    kw: 'pa, ea, executive assistant, personal assistant, secretary',
    side: 'office-manager'
  }),
  'human-resources-officer': e('business', 3, 'people desk office analytical', {
    kw: 'hr, human resources, hr advisor, hr assistant, people advisor, personnel, cipd',
    side: 'recruitment-consultant training-officer payroll-administrator'
  }),
  'recruitment-consultant': e('business', 2, 'people business office', {
    kw: 'recruiter, recruitment, talent acquisition, resourcer',
    up: 'sales-manager',
    side: 'human-resources-officer careers-adviser'
  }),
  'training-officer': e('business', 3, 'people classroom office', {
    kw: 'trainer, learning and development, l&d, training coordinator, coach, workplace trainer',
    side: 'further-education-lecturer qcf-assessor human-resources-officer'
  }),
  'business-project-manager': e('business', 4, 'lead business analytical office', {
    kw: 'project manager, project management, programme manager, project coordinator, pmo, prince2',
    up: 'management-consultant',
    side: 'business-analyst it-project-manager'
  }),
  'business-analyst': e('business', 4, 'analytical desk office', {
    kw: 'business analysis, process analyst, systems analyst, improvement analyst',
    up: 'business-project-manager',
    side: 'data-analyst-statistician management-consultant'
  }),
  'marketing-executive': e('business', 2, 'creative business desk office', {
    kw: 'marketing, digital marketing, marketing assistant, social media, content creator, content marketing, seo',
    up: 'marketing-manager',
    side: 'e-commerce-manager events-manager graphic-designer'
  }),
  'marketing-manager': e('business', 4, 'lead creative business office', {
    kw: 'brand manager, head of marketing',
    side: 'sales-manager e-commerce-manager'
  }),
  'sales-manager': e('business', 4, 'lead business people road', {
    kw: 'sales, sales executive, account manager, area manager, business development, sales representative',
    side: 'marketing-manager retail-manager'
  }),
  'business-adviser': e('business', 4, 'business people solo', {
    kw: 'business consultant, enterprise adviser, business coach, start up adviser',
    side: 'management-consultant'
  }),
  'management-consultant': e('business', 5, 'analytical business people', {
    kw: 'consultant, consulting, strategy',
    side: 'business-adviser'
  }),
  'customer-service-assistant': e('business', 1, 'people desk office team', {
    kw: 'customer service, customer services, call centre, contact centre, customer advisor, customer adviser',
    up: 'supervisor customer-services-manager',
    side: 'receptionist financial-services-customer-adviser sales-assistant'
  }),
  'customer-services-manager': e('business', 4, 'lead people business office', {
    kw: 'customer experience manager, contact centre manager, service manager',
    side: 'retail-manager hotel-manager'
  }),

  // ── Finance & accounting ──────────────────────────────────────────────────
  'accounting-technician': e('finance', 3, 'analytical desk office', {
    kw: 'accounts assistant, aat, finance assistant, purchase ledger, sales ledger, credit controller, accounts payable, accounts receivable, accounting',
    up: 'management-accountant private-practice-accountant',
    side: 'payroll-administrator bookkeeper'
  }),
  bookkeeper: e('finance', 2, 'analytical desk solo office', {
    kw: 'bookkeeping, accounts clerk, xero, sage',
    up: 'accounting-technician',
    side: 'payroll-administrator'
  }),
  'payroll-administrator': e('finance', 2, 'analytical desk office', {
    kw: 'payroll, payroll clerk, payroll officer',
    up: 'accounting-technician',
    side: 'human-resources-officer bookkeeper'
  }),
  'management-accountant': e('finance', 4, 'analytical business office', {
    kw: 'accountant, cima, finance manager, financial controller, management accounts, finance business partner',
    side: 'private-practice-accountant business-analyst management-consultant'
  }),
  'private-practice-accountant': e('finance', 4, 'analytical business office', {
    kw: 'chartered accountant, acca, aca, accountancy, audit, tax accountant',
    side: 'management-accountant business-adviser'
  }),
  'financial-adviser': e('finance', 4, 'people business office', {
    kw: 'ifa, wealth manager, financial planner, paraplanner, investment adviser',
    side: 'mortgage-adviser'
  }),
  'financial-services-customer-adviser': e('finance', 1, 'people desk office', {
    kw: 'bank, banking, bank cashier, cashier, customer adviser bank, building society',
    up: 'mortgage-adviser financial-adviser',
    side: 'customer-service-assistant insurance-claims-handler'
  }),
  'mortgage-adviser': e('finance', 3, 'people business office', {
    kw: 'mortgage broker, mortgages',
    up: 'financial-adviser'
  }),
  'insurance-claims-handler': e('finance', 2, 'desk analytical office people', {
    kw: 'insurance, claims, claims handler, underwriter',
    side: 'financial-services-customer-adviser customer-service-assistant'
  }),

  // ── Retail & sales ────────────────────────────────────────────────────────
  'sales-assistant': e('retail', 1, 'people venue team active', {
    kw: 'retail, shop assistant, store assistant, retail assistant, customer assistant, cashier, checkout, till, shop work, retail colleague, sales advisor',
    up: 'supervisor retail-manager',
    side: 'visual-merchandiser stock-control-assistant customer-service-assistant barista'
  }),
  'retail-manager': e('retail', 4, 'lead business people venue', {
    kw: 'store manager, shop manager, assistant store manager, deputy manager retail, department manager',
    side: 'retail-buyer e-commerce-manager customer-services-manager sales-manager'
  }),
  'visual-merchandiser': e('retail', 2, 'creative hands venue', {
    kw: 'merchandiser, window dresser, display',
    side: 'interior-designer retail-buyer graphic-designer'
  }),
  'retail-buyer': e('retail', 4, 'analytical business office', {
    kw: 'buyer, buying, merchandising',
    side: 'purchasing-manager supply-chain-manager'
  }),
  'e-commerce-manager': e('retail', 4, 'tech business lead office', {
    kw: 'ecommerce, e-commerce, online retail, online store, digital trading',
    side: 'marketing-manager web-developer'
  }),
  'stock-control-assistant': e('retail', 1, 'hands analytical team', {
    kw: 'stock, stock controller, stores person, storeman, replenishment, inventory, goods in',
    up: 'warehouse-manager retail-buyer',
    side: 'warehouse-worker sales-assistant'
  }),

  // ── Hospitality & catering ───────────────────────────────────────────────
  waiter: e('hospitality', 1, 'people venue team active', {
    kw: 'waitress, waiting staff, server, food service, front of house, food and beverage, hospitality',
    up: 'restaurant-manager',
    side: 'bar-person barista receptionist'
  }),
  'bar-person': e('hospitality', 1, 'people venue team active', {
    kw: 'bartender, bar staff, bar tender, pub, mixologist',
    up: 'supervisor restaurant-manager',
    side: 'waiter barista'
  }),
  barista: e('hospitality', 1, 'people venue hands', {
    kw: 'coffee, cafe, coffee shop',
    up: 'supervisor retail-manager',
    side: 'waiter sales-assistant'
  }),
  'kitchen-assistant': e('hospitality', 1, 'hands team active venue', {
    kw: 'kitchen porter, kp, food prep, catering assistant, kitchen staff',
    up: 'chef',
    side: 'waiter food-factory-worker'
  }),
  chef: e('hospitality', 2, 'hands creative team venue active', {
    kw: 'cook, commis chef, sous chef, head chef, chef de partie, professional cookery, catering, culinary, hospitality and catering',
    up: 'catering-manager restaurant-manager',
    side: 'kitchen-assistant'
  }),
  'catering-manager': e('hospitality', 4, 'lead business venue', {
    kw: 'catering manager, kitchen manager, food service manager',
    side: 'events-manager facilities-manager'
  }),
  'restaurant-manager': e('hospitality', 4, 'lead people business venue', {
    kw: 'restaurant manager, assistant manager restaurant, bar manager, pub manager, general manager restaurant',
    up: 'hotel-manager',
    side: 'events-manager catering-manager'
  }),
  'hotel-manager': e('hospitality', 5, 'lead people business venue', {
    kw: 'hotel, hotel general manager, front office manager, hospitality manager',
    side: 'events-manager customer-services-manager'
  }),
  housekeeper: e('hospitality', 1, 'hands venue active solo', {
    kw: 'housekeeping, room attendant, chambermaid, cleaner',
    up: 'supervisor',
    side: 'receptionist'
  }),
  'events-manager': e('hospitality', 4, 'lead creative people business', {
    kw: 'events, event planner, events coordinator, conference, wedding planner',
    side: 'marketing-manager'
  }),

  // ── Education & training ─────────────────────────────────────────────────
  'teaching-assistant': e('education', 2, 'care people classroom team', {
    kw: 'ta, classroom assistant, learning support assistant, lsa, hlta, education, childcare',
    up: 'primary-school-teacher',
    side: 'special-educational-needs-sen-teaching-assistant learning-mentor youth-worker'
  }),
  'special-educational-needs-sen-teaching-assistant': e('education', 2, 'care people classroom', {
    kw: 'sen, send, special needs, sen ta, 1:1 support',
    up: 'primary-school-teacher',
    side: 'teaching-assistant'
  }),
  'primary-school-teacher': e('education', 4, 'care people creative classroom', {
    kw: 'primary teacher, teacher, teaching, pgce, qts',
    side: 'secondary-school-teacher careers-adviser'
  }),
  'secondary-school-teacher': e('education', 4, 'people analytical classroom', {
    kw: 'secondary teacher, high school teacher, teacher, teaching',
    side: 'further-education-lecturer careers-adviser'
  }),
  'further-education-lecturer': e('education', 4, 'people classroom', {
    kw: 'lecturer, college lecturer, fe teacher, tutor, college tutor, vocational teacher, trade lecturer',
    side: 'qcf-assessor training-officer'
  }),
  'qcf-assessor': e('education', 3, 'people road classroom', {
    kw: 'assessor, nvq assessor, skills coach, apprenticeship assessor, apprenticeship coach, trainer assessor, development coach',
    up: 'further-education-lecturer',
    side: 'training-officer'
  }),
  'careers-adviser': e('education', 4, 'care people office', {
    kw: 'careers, career coach, careers advisor, careers guidance',
    side: 'youth-worker learning-mentor'
  }),
  'learning-mentor': e('education', 2, 'care people classroom', {
    kw: 'mentor, pastoral, student support',
    up: 'careers-adviser',
    side: 'teaching-assistant youth-worker'
  }),

  // ── Transport & logistics ─────────────────────────────────────────────────
  'warehouse-worker': e('transport', 1, 'hands active team workshop', {
    kw: 'warehouse, warehouse operative, picker, packer, logistics, distribution, despatch, dispatch, order picker',
    up: 'supervisor warehouse-manager',
    side: 'forklift-driver stock-control-assistant delivery-van-driver'
  }),
  'forklift-driver': e('transport', 1, 'hands workshop solo', {
    kw: 'forklift, flt, forklift operator, reach truck, counterbalance',
    up: 'warehouse-manager',
    side: 'large-goods-vehicle-driver warehouse-worker'
  }),
  'warehouse-manager': e('transport', 4, 'lead business workshop', {
    kw: 'warehouse manager, depot manager, logistics manager, distribution manager, shift manager warehouse',
    up: 'supply-chain-manager',
    side: 'road-transport-manager'
  }),
  'delivery-van-driver': e('transport', 1, 'road solo active', {
    kw: 'delivery driver, van driver, courier, multi drop, driver',
    up: 'large-goods-vehicle-driver road-transport-manager',
    side: 'warehouse-worker'
  }),
  'large-goods-vehicle-driver': e('transport', 2, 'road solo', {
    kw: 'hgv, lgv, lorry driver, truck driver, class 1, class 2, haulage',
    up: 'road-transport-manager'
  }),
  'road-transport-manager': e('transport', 4, 'lead analytical office', {
    kw: 'transport manager, fleet manager, transport planner, traffic office',
    up: 'supply-chain-manager',
    side: 'transport-planner'
  }),
  'supply-chain-manager': e('transport', 5, 'lead analytical business office', {
    kw: 'supply chain, logistics, operations manager logistics',
    side: 'purchasing-manager'
  }),
  'transport-planner': e('transport', 4, 'analytical desk office', {
    kw: 'transport planning, traffic planner',
    side: 'road-transport-manager'
  }),
  'purchasing-manager': e('transport', 4, 'business analytical office', {
    kw: 'procurement, purchasing, buyer procurement, purchaser, cips',
    side: 'supply-chain-manager retail-buyer'
  }),

  // ── Public services ───────────────────────────────────────────────────────
  'police-officer': e('public', 3, 'people active team road', {
    kw: 'police, police constable, pcso, policing',
    side: 'firefighter'
  }),
  firefighter: e('public', 2, 'active hands team people', {
    kw: 'fire service, firefighting, fireman',
    side: 'paramedic health-and-safety-adviser'
  }),
  'youth-worker': e('public', 3, 'care people creative', {
    kw: 'youth work, youth support, community worker',
    side: 'social-worker careers-adviser'
  }),
  'social-worker': e('public', 4, 'care people analytical', {
    kw: 'social work, social care practitioner',
    side: 'youth-worker care-home-manager'
  }),

  // ── Creative & design ─────────────────────────────────────────────────────
  'graphic-designer': e('creative', 3, 'creative tech desk', {
    kw: 'graphic design, designer, illustrator, art and design, adobe, creative media',
    side: 'ux-designer marketing-executive web-developer'
  }),
  'interior-designer': e('creative', 3, 'creative people business', {
    kw: 'interior design, interiors, interior architect',
    side: 'visual-merchandiser furniture-maker'
  }),
  'product-designer': e('creative', 4, 'creative analytical tech', {
    kw: 'product design, industrial design, design and technology, 3d design',
    side: 'design-and-development-engineer cad-technician'
  }),

  // ── Sport & fitness ───────────────────────────────────────────────────────
  'personal-trainer': e('sport', 2, 'people active solo venue business', {
    kw: 'pt, personal training, fitness coach, sports coaching, sport and exercise',
    side: 'physiotherapy-assistant fitness-instructor'
  }),
  'fitness-instructor': e('sport', 1, 'people active venue', {
    kw: 'gym instructor, fitness, gym, leisure, sport, sports',
    up: 'personal-trainer'
  })
};

export const SECTORS: { id: Sector; label: string; short: string; emoji: string }[] = [
  { id: 'manufacturing', label: 'Manufacturing & boatbuilding', short: 'Manufacturing', emoji: '⚓' },
  { id: 'construction', label: 'Construction & trades', short: 'Construction', emoji: '🏗️' },
  { id: 'engineering', label: 'Engineering', short: 'Engineering', emoji: '⚙️' },
  { id: 'digital', label: 'IT & digital', short: 'IT & digital', emoji: '💻' },
  { id: 'health', label: 'Health & social care', short: 'Health & care', emoji: '🩺' },
  { id: 'business', label: 'Business & administration', short: 'Business', emoji: '📊' },
  { id: 'finance', label: 'Finance & accounting', short: 'Finance', emoji: '💷' },
  { id: 'retail', label: 'Retail & sales', short: 'Retail', emoji: '🛍️' },
  { id: 'hospitality', label: 'Hospitality & catering', short: 'Hospitality', emoji: '🍽️' },
  { id: 'education', label: 'Education & training', short: 'Education', emoji: '🎓' },
  { id: 'transport', label: 'Transport & logistics', short: 'Transport', emoji: '🚚' },
  { id: 'public', label: 'Public services', short: 'Public services', emoji: '🛡️' },
  { id: 'creative', label: 'Creative & design', short: 'Creative', emoji: '🎨' },
  { id: 'sport', label: 'Sport & fitness', short: 'Sport', emoji: '🏃' }
];

export const sectorLabel = (id: string) => SECTORS.find((s) => s.id === id)?.label ?? id;
export const sectorShort = (id: string) => SECTORS.find((s) => s.id === id)?.short ?? id;

export const LEVEL_LABEL: Record<Level, string> = {
  1: 'Entry level',
  2: 'Skilled / qualified',
  3: 'Senior, technical or supervisory',
  4: 'Professional or manager',
  5: 'Senior manager'
};
