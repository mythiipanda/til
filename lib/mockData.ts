import { NodeSchema } from '@/types/graph';

export interface PrecomputedHub {
  root: NodeSchema;
  children: NodeSchema[];
}

export const PRECOMPUTED_HUBS: Record<string, PrecomputedHub> = {
  'epic wars & battles': {
    root: {
      id: 'hub-hannibal-root',
      title: 'Hannibal Crossing the Alps with War Elephants',
      summary: 'In 218 BCE, general Hannibal Barca stunned Rome by marching an army of 30,000 soldiers and 37 war elephants across the freezing, treacherous Alps mountains.',
      category: 'Epic Wars & Battles',
      coordinates: { lat: 45.0703, lng: 7.6869, tileX: 2135, tileY: 1460, location_name: 'The Alps, Italy' },
      image_search_query: 'Hannibal crossing Alps elephants painting',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Hannibal_traversant_les_Alpes_-_Clairin.jpg/800px-Hannibal_traversant_les_Alpes_-_Clairin.jpg',
      rabbit_holes: ['Battle of Cannae Double Envelopment', 'War Elephants in Ancient Combat', 'Scipio Africanus Counter-Invasion'],
      timestamp: '218 BCE',
      confidence: 0.99,
      audio_summary: 'Imagine looking up at the snowy peaks of the Alps and seeing 37 African war elephants marching into Italy. Hannibal pulled off the most daring sneak attack in military history.'
    },
    children: [
      {
        id: 'hub-hannibal-c1',
        title: 'The Battle of Cannae & The Double Envelopment',
        summary: 'Hannibal used a horseshoe trap to surround and wipe out a Roman army nearly twice his size, inventing a tactical formation still taught in military academies today.',
        category: 'Epic Wars & Battles',
        coordinates: { lat: 41.3060, lng: 16.1478, tileX: 2232, tileY: 1530, location_name: 'Cannae, Apulia, Italy' },
        image_search_query: 'Battle of Cannae map diagram',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Battle_of_Cannae_destr.svg/800px-Battle_of_Cannae_destr.svg.png',
        rabbit_holes: ['Roman Legionary Tactics', 'Carthaginian Cavalry Superiority', 'The Aftermath in Rome'],
        timestamp: '216 BCE',
        confidence: 0.98,
        audio_summary: 'Cannae was the deadliest day in Roman history, where Hannibal executed the greatest tactical masterpiece of the ancient world.'
      },
      {
        id: 'hub-hannibal-c2',
        title: 'How Ancient Armies Used War Elephants',
        summary: 'War elephants acted as living tanks, terrorizing enemy horses and trampling infantry lines with mounted archers and spearmen riding atop.',
        category: 'Ancient Warfare',
        coordinates: { lat: 36.8529, lng: 10.3217, tileX: 2170, tileY: 1620, location_name: 'Carthage, Modern Tunisia' },
        image_search_query: 'War elephant armor ancient history',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/War_elephants_Carthage.jpg/800px-War_elephants_Carthage.jpg',
        rabbit_holes: ['North African Elephant Extinction', 'Anti-Elephant Tactics and Flaming Pigs', 'Alexander the Great vs War Elephants'],
        timestamp: 'c. 300 BCE',
        confidence: 0.97,
        audio_summary: 'Elephants were the psychological superweapons of antiquity, causing sheer chaos on the battlefield whenever they charged.'
      },
      {
        id: 'hub-hannibal-c3',
        title: 'Scipio Africanus & The Clash at Zama',
        summary: 'Young Roman general Scipio studied Hannibal’s own playbook and defeated him at the Battle of Zama by opening lanes in his ranks for the charging elephants to pass harmlessly through.',
        category: 'Epic Wars & Battles',
        coordinates: { lat: 36.3000, lng: 9.3000, tileX: 2155, tileY: 1635, location_name: 'Zama, North Africa' },
        image_search_query: 'Battle of Zama Scipio Africanus',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Battle_of_Zama_by_Giulio_Romano.jpg/800px-Battle_of_Zama_by_Giulio_Romano.jpg',
        rabbit_holes: ['The Fall of Carthage', 'Scipio Africanus Exile', 'The Punic Peace Treaties'],
        timestamp: '202 BCE',
        confidence: 0.98,
        audio_summary: 'At Zama, Scipio outsmarted the master himself, using loud trumpets and clever gaps in his battle lines to neutralize Hannibal’s elephants.'
      }
    ]
  },
  'fascinating history': {
    root: {
      id: 'hub-history-root',
      title: 'The Dancing Plague of 1518',
      summary: 'In July 1518, hundreds of residents of Strasbourg danced uncontrollably in the streets for days without rest in one of the strangest mass events in human history.',
      category: 'Fascinating History',
      coordinates: { lat: 48.5734, lng: 7.7521, tileX: 2136, tileY: 1414, location_name: 'Strasbourg, France' },
      image_search_query: 'Danse macabre Strasbourg medieval engraving',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Pieter_Brueghel_the_Elder_-_The_Triumph_of_Death_-_Google_Art_Project.jpg/800px-Pieter_Brueghel_the_Elder_-_The_Triumph_of_Death_-_Google_Art_Project.jpg',
      rabbit_holes: ['Ergot Poisoning in Medieval Bread', 'Mass Hysteria & Mind Outbreaks', 'The St. Vitus Mountain Shrine'],
      timestamp: '1518 CE',
      confidence: 0.98,
      audio_summary: 'In the scorching summer of 1518, a woman stepped into the street and started dancing without music. Within weeks, hundreds joined her in an inescapable trance.'
    },
    children: [
      {
        id: 'hub-history-c1',
        title: 'Ergot Poisoning: The Moldy Bread Theory',
        summary: 'A toxic fungus called ergot grows on damp rye and contains chemicals related to LSD, which could have triggered hallucinations and involuntary muscle spasms.',
        category: 'Fascinating History',
        coordinates: { lat: 47.9959, lng: 7.8522, tileX: 2136, tileY: 1420, location_name: 'Black Forest, Germany' },
        image_search_query: 'Claviceps purpurea rye ergot fungus',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Claviceps_purpurea_01.jpg/800px-Claviceps_purpurea_01.jpg',
        rabbit_holes: ['Salem Witch Trials Bread Mold Theory', 'Albert Hofmann LSD Discovery', 'Medieval Famine Years'],
        timestamp: '1518 CE',
        confidence: 0.96,
        audio_summary: 'Was it mass hysteria, or did an entire town eat bread contaminated with a psychedelic mold? Scientists and historians still debate it.'
      },
      {
        id: 'hub-history-c2',
        title: 'The Tanganyika Laughter Outbreak of 1962',
        summary: 'In 1962, a spontaneous epidemic of laughing and crying spread across boarding schools in Tanzania, lasting for months without any biological virus.',
        category: 'Fascinating History',
        coordinates: { lat: -1.3314, lng: 31.8122, tileX: 2410, tileY: 2060, location_name: 'Kashasha, Tanzania' },
        image_search_query: 'Psychology history crowd hysteria collective behavior',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Charcot_at_the_Salp%C3%AAtri%C3%A8re.jpg/800px-Charcot_at_the_Salp%C3%AAtri%C3%A8re.jpg',
        rabbit_holes: ['How Laughter Is Contagious', 'Stress Outbreaks in High Schools', 'The Placebo and Nocebo Effects'],
        timestamp: '1962 CE',
        confidence: 0.95,
        audio_summary: 'Under extreme social pressure, human brains can mirror bizarre physical symptoms in groups, spreading laughter or dancing like wildfire.'
      },
      {
        id: 'hub-history-c3',
        title: 'Red Shoes & Shrines: The Medieval Cure',
        summary: 'Desperate city leaders hired musicians and built a wooden stage to let them dance it out, before marching the victims in red shoes to a mountain sanctuary.',
        category: 'Fascinating History',
        coordinates: { lat: 48.7417, lng: 7.3622, tileX: 2130, tileY: 1408, location_name: 'Saverne, France' },
        image_search_query: 'Saint Vitus cathedral medieval relic altar',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/St._Vitus_Cathedral_Prague_2016_1.jpg/800px-St._Vitus_Cathedral_Prague_2016_1.jpg',
        rabbit_holes: ['Tarantism: The Spider Dance Cure', 'Medieval Bloodletting Treatments', 'The Folklore of St. Vitus'],
        timestamp: '1518 CE',
        confidence: 0.97,
        audio_summary: 'The city thought more dancing would cure the dancers, but it only made things worse until they brought the survivors up to a quiet mountain shrine.'
      }
    ]
  },
  'ancient inventions': {
    root: {
      id: 'hub-tech-root',
      title: 'The 2,000-Year-Old Antikythera Bronze Computer',
      summary: 'Recovered from a Greek shipwreck, this shoebox-sized bronze device with 30 precision gears predicted solar eclipses, planet orbits, and Olympic Games in 150 BCE.',
      category: 'Ancient Inventions',
      coordinates: { lat: 35.8870, lng: 23.3030, tileX: 2280, tileY: 1590, location_name: 'Antikythera Island, Greece' },
      image_search_query: 'Antikythera mechanism bronze relic Athens',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/NAMA_Machine_d%27Anticyth%C3%A8re_1.jpg/800px-NAMA_Machine_d%27Anticyth%C3%A8re_1.jpg',
      rabbit_holes: ['Archimedes Lost Mechanical Planetarium', 'X-Ray CT Scans of Ancient Gears', 'The Greek Shipwreck Gold Treasure'],
      timestamp: 'c. 150 BCE',
      confidence: 0.99,
      audio_summary: 'Two thousand years before the first mechanical clock, ancient Greek engineers built a handheld bronze computer that calculated the cosmos.'
    },
    children: [
      {
        id: 'hub-tech-c1',
        title: 'Archimedes and the Lost Planetarium',
        summary: 'Ancient Roman writer Cicero described a legendary mechanical bronze globe built by Archimedes that could show the motions of the Sun, Moon, and 5 known planets.',
        category: 'Ancient Inventions',
        coordinates: { lat: 37.0755, lng: 15.2866, tileX: 2225, tileY: 1575, location_name: 'Syracuse, Sicily' },
        image_search_query: 'Archimedes Syracuse ancient inventor',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/41598_2021_84310_MOESM4_ESM.pdf/page1-960px-41598_2021_84310_MOESM4_ESM.pdf.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
        rabbit_holes: ['Archimedes Death Ray Mirror Myth', 'The Claw of Archimedes Ship Sinker', 'The Archimedes Palimpsest Geometry'],
        timestamp: 'c. 212 BCE',
        confidence: 0.97,
        audio_summary: 'Was the Antikythera Mechanism based on Archimedes’ lost inventions? Historians believe a hidden school of master engineers survived his death.'
      },
      {
        id: 'hub-tech-c2',
        title: 'Hero of Alexandria & The First Steam Engine',
        summary: 'In 60 CE, Hero of Alexandria built the Aeolipile—a spinning brass sphere powered by steam jet propulsion—1,700 years before the Industrial Revolution.',
        category: 'Ancient Inventions',
        coordinates: { lat: 31.2001, lng: 29.9187, tileX: 2365, tileY: 1675, location_name: 'Alexandria, Egypt' },
        image_search_query: 'Aeolipile steam engine Hero of Alexandria',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Hero%27s_Aeolipile%2C_1st_century_AD%2C_Alexandria_%28reconstruction%29.jpg/960px-Hero%27s_Aeolipile%2C_1st_century_AD%2C_Alexandria_%28reconstruction%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
        rabbit_holes: ['Automatic Temple Doors Using Fire', 'The First Coin-Operated Vending Machine', 'Ancient Greek Programmable Robots'],
        timestamp: 'c. 60 CE',
        confidence: 0.98,
        audio_summary: 'Ancient Alexandria had automatic doors opened by temple fires, mechanical theater shows, and the world’s very first steam turbine.'
      },
      {
        id: 'hub-tech-c3',
        title: 'X-Ray CT Scanners Uncover the Secret Gears',
        summary: 'In 2005, scientists hauled an 8-ton X-ray machine to Athens to look inside the corroded lumps, revealing 3D gears with teeth under 2 millimeters wide.',
        category: 'Modern Science',
        coordinates: { lat: 37.9838, lng: 23.7275, tileX: 2280, tileY: 1570, location_name: 'Athens, Greece' },
        image_search_query: 'Antikythera CT scan gear reconstruction',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/ArPalimTyp2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled',
        rabbit_holes: ['Deciphering 2,000 Greek Inscription Letters', '3D Printed Modern Working Replicas', 'The Missing Gear Mystery'],
        timestamp: '2005 CE',
        confidence: 0.99,
        audio_summary: 'Using 3D X-rays, researchers found an entire user manual etched into the bronze plates in ancient Greek.'
      }
    ]
  }
};
