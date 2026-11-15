/**
 * Verification script: verifies that all 23 anatomical regions map to at least one real mesh.
 * Exits with status code 1 if any region has zero matching meshes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, '../src/data/structureIndex.json');

if (!fs.existsSync(indexPath)) {
  console.error('Error: structureIndex.json not found at ' + indexPath);
  process.exit(1);
}

const structureIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

function isLeft(name) {
  return name.endsWith('.l') || name.includes('.l ') || name.includes('left ') || name.includes('Left ');
}

function isRight(name) {
  return name.endsWith('.r') || name.includes('.r ') || name.includes('right ') || name.includes('Right ');
}

const REGION_MATCHERS = {
  head: (name) => {
    if (/\bhead of (femur|humerus|radius|fibula|rib|stapes|talus|pancreas|epididymis)\b/i.test(name)) return false;
    return /\b(skull|cranium|face|brain|cerebr|thalam|pons|frontal|parietal|occipital|temporal bone|sphenoid|ethmoid|mandible|maxilla|nose|nasal|eye|ocular|orbital|tongue|tooth|teeth|masseter|temporalis|zygomatic|eyelid|lip|facial nerve|hypothalam|hypophysis|pineal|olfactory|optic nerve|scalp|auricle|galea|\bhead\b)\b/i.test(name);
  },

  neck: (name) =>
    /\b(c1|c2|c3|c4|c5|c6|c7|cervical|neck|larynx|pharynx|thyroid|trachea|hyoid|carotid|jugular|sternocleidomastoid|scalene|atlas|axis|phrenic)\b/i.test(name),

  left_shoulder: (name) =>
    isLeft(name) &&
    /\b(clavicle|scapula|deltoid|supraspinatus|infraspinatus|subscapularis|teres major|teres minor|glenohumeral|acromi|shoulder|coracoid|rotator cuff|axillary)\b/i.test(name),

  right_shoulder: (name) =>
    isRight(name) &&
    /\b(clavicle|scapula|deltoid|supraspinatus|infraspinatus|subscapularis|teres major|teres minor|glenohumeral|acromi|shoulder|coracoid|rotator cuff|axillary)\b/i.test(name),

  chest: (name) =>
    !/\b(thoracic vertebra|t[1-9] vertebra|t1[0-2] vertebra)\b/i.test(name) &&
    /\b(thorax|thoracic|sternum|rib|costal|pectoral|heart|cardiac|pericard|lung|pulmonary|bronch|intercostal|internal thoracic|aorta|vena cava|thymus|diaphragm)\b/i.test(name),

  upper_back: (name) =>
    /\b(thoracic vertebra|t[1-9] vertebra|t1[0-2] vertebra|trapezius|rhomboid|latissimus|thoracic spine|thoracic disc|spine of scapula)\b/i.test(name),

  abdomen: (name) =>
    !/\b(lumbar vertebra|l[1-5] vertebra)\b/i.test(name) &&
    /\b(abdomen|abdominal|rectus abdominis|oblique muscle|transversus abdominis|stomach|gastric|liver|hepatic|spleen|pancreas|duodenum|jejunum|ileum|colon|omentum|mesentery|peritoneum|celiac)\b/i.test(name),

  lumbar_spine: (name) =>
    /\b(lumbar|l[1-5]|erector spinae|multifidus|quadratus lumborum|psoas|intervertebral disc of lumbar|cauda equina|lumbar plexus)\b/i.test(name),

  pelvis: (name) =>
    /\b(pelvis|pelvic|sacrum|coccyx|ilium|iliac|ischium|pubis|pubic|gluteus|piriformis|obturator|bladder|rectum|perineum|sacroiliac|acetabul|pudendal)\b/i.test(name),

  left_arm: (name) =>
    isLeft(name) &&
    /\b(humerus|brachii|biceps brachii|triceps brachii|brachialis|coracobrachialis|brachial artery|brachial vein|arm\.l)\b/i.test(name),

  right_arm: (name) =>
    isRight(name) &&
    /\b(humerus|brachii|biceps brachii|triceps brachii|brachialis|coracobrachialis|brachial artery|brachial vein|arm\.r)\b/i.test(name),

  left_forearm: (name) =>
    isLeft(name) &&
    !/\b(carpal|metacarpal|hand|digit of hand)\b/i.test(name) &&
    /\b(radius|ulna|forearm|brachioradialis|pronator|supinator|radial artery|ulnar artery|radial nerve|ulnar nerve|median nerve|flexor digitorum|extensor digitorum|flexor carpi|extensor carpi|elbow)\b/i.test(name),

  right_forearm: (name) =>
    isRight(name) &&
    !/\b(carpal|metacarpal|hand|digit of hand)\b/i.test(name) &&
    /\b(radius|ulna|forearm|brachioradialis|pronator|supinator|radial artery|ulnar artery|radial nerve|ulnar nerve|median nerve|flexor digitorum|extensor digitorum|flexor carpi|extensor carpi|elbow)\b/i.test(name),

  left_hand: (name) =>
    isLeft(name) &&
    /\b(hand|wrist|carpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx of hand|thenar|hypothenar|palmar|finger|thumb|digit of hand)\b/i.test(name),

  right_hand: (name) =>
    isRight(name) &&
    /\b(hand|wrist|carpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx of hand|thenar|hypothenar|palmar|finger|thumb|digit of hand)\b/i.test(name),

  left_thigh: (name) =>
    isLeft(name) &&
    !/\b(patella|knee)\b/i.test(name) &&
    /\b(femur|thigh|quadriceps|rectus femoris|vastus lateralis|vastus medialis|vastus intermedius|hamstring|biceps femoris|semitendinosus|semimembranosus|sartorius|gracilis|adductor|femoral)\b/i.test(name),

  right_thigh: (name) =>
    isRight(name) &&
    !/\b(patella|knee)\b/i.test(name) &&
    /\b(femur|thigh|quadriceps|rectus femoris|vastus lateralis|vastus medialis|vastus intermedius|hamstring|biceps femoris|semitendinosus|semimembranosus|sartorius|gracilis|adductor|femoral)\b/i.test(name),

  left_knee: (name) =>
    isLeft(name) &&
    /\b(patella|knee|meniscus|cruciate ligament|collateral ligament|popliteal)\b/i.test(name),

  right_knee: (name) =>
    isRight(name) &&
    /\b(patella|knee|meniscus|cruciate ligament|collateral ligament|popliteal)\b/i.test(name),

  left_leg: (name) =>
    isLeft(name) &&
    !/\b(foot|ankle|talus|calcaneus|tarsal|metatarsal)\b/i.test(name) &&
    /\b(tibia|fibula|shin|calf|crural|gastrocnemius|soleus|tibialis|peroneus|fibularis|leg\.l)\b/i.test(name),

  right_leg: (name) =>
    isRight(name) &&
    !/\b(foot|ankle|talus|calcaneus|tarsal|metatarsal)\b/i.test(name) &&
    /\b(tibia|fibula|shin|calf|crural|gastrocnemius|soleus|tibialis|peroneus|fibularis|leg\.r)\b/i.test(name),

  left_foot: (name) =>
    isLeft(name) &&
    /\b(foot|ankle|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx of foot|plantar|toe|hallux|digit of foot)\b/i.test(name),

  right_foot: (name) =>
    isRight(name) &&
    /\b(foot|ankle|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx of foot|plantar|toe|hallux|digit of foot)\b/i.test(name),
};

const results = {};
let failedCount = 0;

for (const [id, matcher] of Object.entries(REGION_MATCHERS)) {
  const matches = structureIndex.filter((s) => matcher(s.name));
  results[id] = matches.length;
  if (matches.length === 0) {
    console.error(`FAIL: Region "${id}" mapped to 0 meshes!`);
    failedCount++;
  }
}

console.log('--- 23 Anatomical Regions Mesh Validation ---');
console.table(results);

if (failedCount > 0) {
  console.error(`Validation failed with ${failedCount} unmapped regions!`);
  process.exit(1);
} else {
  console.log('PASS: All 23 regions successfully mapped to real Z-Anatomy meshes.');
  process.exit(0);
}
