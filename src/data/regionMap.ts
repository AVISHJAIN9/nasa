/**
 * Anatomical Region Mapping for Z-Anatomy 3D Model
 * Maps 23 anatomical regions to real meshes and za_name patterns.
 */

export interface AnatomicalRegionMeta {
  id: string;
  label: string;
  aliases: string[];
  approxCenter: [number, number, number]; // [x, y, z] in normalized body space
}

export const ANATOMICAL_REGIONS: AnatomicalRegionMeta[] = [
  {id: 'head', label: 'Cranium / Head', aliases: ['head_back', 'cranium'], approxCenter: [0, 1.62, 0]},
  {id: 'neck', label: 'Cervical Spine / Neck', aliases: ['neck_back', 'cervical'], approxCenter: [0, 1.47, 0]},
  {id: 'left_shoulder', label: 'Left Shoulder', aliases: ['shoulder_l'], approxCenter: [0.20, 1.37, 0]},
  {id: 'right_shoulder', label: 'Right Shoulder', aliases: ['shoulder_r'], approxCenter: [-0.20, 1.37, 0]},
  {id: 'chest', label: 'Thorax / Chest', aliases: ['thorax'], approxCenter: [0, 1.28, 0.04]},
  {id: 'upper_back', label: 'Upper Back / Thoracic Spine', aliases: ['thoracic_spine'], approxCenter: [0, 1.28, -0.06]},
  {id: 'abdomen', label: 'Abdomen', aliases: ['upper_abdomen', 'lower_abdomen'], approxCenter: [0, 1.05, 0.04]},
  {id: 'left_abdomen', label: 'Left Abdomen', aliases: ['abdomen_l', 'left_upper_abdomen', 'left_lower_abdomen'], approxCenter: [0.10, 1.05, 0.04]},
  {id: 'right_abdomen', label: 'Right Abdomen', aliases: ['abdomen_r', 'right_upper_abdomen', 'right_lower_abdomen'], approxCenter: [-0.10, 1.05, 0.04]},
  {id: 'lumbar_spine', label: 'Lumbar Spine (L1-S1)', aliases: ['lumbar'], approxCenter: [0, 1.05, -0.06]},
  {id: 'pelvis', label: 'Pelvis / Hips', aliases: ['pelvis_back', 'sacrum'], approxCenter: [0, 0.88, 0]},
  {id: 'left_arm', label: 'Left Upper Arm', aliases: ['arm_l'], approxCenter: [0.25, 1.18, 0]},
  {id: 'right_arm', label: 'Right Upper Arm', aliases: ['arm_r'], approxCenter: [-0.25, 1.18, 0]},
  {id: 'left_forearm', label: 'Left Forearm', aliases: ['forearm_l'], approxCenter: [0.29, 0.94, 0]},
  {id: 'right_forearm', label: 'Right Forearm', aliases: ['forearm_r'], approxCenter: [-0.29, 0.94, 0]},
  {id: 'left_hand', label: 'Left Hand / Wrist', aliases: ['hand_l'], approxCenter: [0.32, 0.76, 0]},
  {id: 'right_hand', label: 'Right Hand / Wrist', aliases: ['hand_r'], approxCenter: [-0.32, 0.76, 0]},
  {id: 'left_thigh', label: 'Left Thigh', aliases: ['left_thigh_back', 'thigh_l'], approxCenter: [0.10, 0.65, 0]},
  {id: 'right_thigh', label: 'Right Thigh', aliases: ['right_thigh_back', 'thigh_r'], approxCenter: [-0.10, 0.65, 0]},
  {id: 'left_knee', label: 'Left Knee', aliases: ['knee_l'], approxCenter: [0.10, 0.46, 0.02]},
  {id: 'right_knee', label: 'Right Knee', aliases: ['knee_r'], approxCenter: [-0.10, 0.46, 0.02]},
  {id: 'left_leg', label: 'Left Knee / Shin / Calf', aliases: ['left_calf', 'shin_l'], approxCenter: [0.10, 0.27, 0]},
  {id: 'right_leg', label: 'Right Knee / Shin / Calf', aliases: ['right_calf', 'shin_r'], approxCenter: [-0.10, 0.27, 0]},
  {id: 'left_foot', label: 'Left Foot / Ankle', aliases: ['foot_l'], approxCenter: [0.10, 0.04, 0.05]},
  {id: 'right_foot', label: 'Right Foot / Ankle', aliases: ['foot_r'], approxCenter: [-0.10, 0.04, 0.05]},
];

function isLeft(name: string): boolean {
  return name.endsWith('.l') || name.includes('.l ') || name.includes('left ') || name.includes('Left ');
}

function isRight(name: string): boolean {
  return name.endsWith('.r') || name.includes('.r ') || name.includes('right ') || name.includes('Right ');
}

// Map predicates for 23 anatomical regions
export const REGION_MATCHERS: Record<string, (name: string) => boolean> = {
  head: (name: string) => {
    if (/\bhead of (femur|humerus|radius|fibula|rib|stapes|talus|pancreas|epididymis)\b/i.test(name)) return false;
    return /\b(skull|cranium|face|brain|cerebr|thalam|pons|frontal|parietal|occipital|temporal bone|sphenoid|ethmoid|mandible|maxilla|nose|nasal|eye|ocular|orbital|tongue|tooth|teeth|masseter|temporalis|zygomatic|eyelid|lip|facial nerve|hypothalam|hypophysis|pineal|olfactory|optic nerve|scalp|auricle|galea|\bhead\b)\b/i.test(name);
  },

  neck: (name: string) =>
    /\b(c1|c2|c3|c4|c5|c6|c7|cervical|neck|larynx|pharynx|thyroid|trachea|hyoid|carotid|jugular|sternocleidomastoid|scalene|atlas|axis|phrenic)\b/i.test(name),

  left_shoulder: (name: string) =>
    isLeft(name) &&
    /\b(clavicle|scapula|deltoid|supraspinatus|infraspinatus|subscapularis|teres major|teres minor|glenohumeral|acromi|shoulder|coracoid|rotator cuff|axillary)\b/i.test(name),

  right_shoulder: (name: string) =>
    isRight(name) &&
    /\b(clavicle|scapula|deltoid|supraspinatus|infraspinatus|subscapularis|teres major|teres minor|glenohumeral|acromi|shoulder|coracoid|rotator cuff|axillary)\b/i.test(name),

  chest: (name: string) =>
    !/\b(thoracic vertebra|t[1-9] vertebra|t1[0-2] vertebra)\b/i.test(name) &&
    /\b(thorax|thoracic|sternum|rib|costal|pectoral|heart|cardiac|pericard|lung|pulmonary|bronch|intercostal|internal thoracic|aorta|vena cava|thymus|diaphragm)\b/i.test(name),

  upper_back: (name: string) =>
    /\b(thoracic vertebra|t[1-9] vertebra|t1[0-2] vertebra|trapezius|rhomboid|latissimus|thoracic spine|thoracic disc|spine of scapula)\b/i.test(name),

  abdomen: (name: string) =>
    !/\b(lumbar vertebra|l[1-5] vertebra)\b/i.test(name) &&
    /\b(abdomen|abdominal|rectus abdominis|oblique muscle|transversus abdominis|stomach|gastric|liver|hepatic|spleen|pancreas|duodenum|jejunum|ileum|colon|omentum|mesentery|peritoneum|celiac)\b/i.test(name),

  lumbar_spine: (name: string) =>
    /\b(lumbar|l[1-5]|erector spinae|multifidus|quadratus lumborum|psoas|intervertebral disc of lumbar|cauda equina|lumbar plexus)\b/i.test(name),

  pelvis: (name: string) =>
    /\b(pelvis|pelvic|sacrum|coccyx|ilium|iliac|ischium|pubis|pubic|gluteus|piriformis|obturator|bladder|rectum|perineum|sacroiliac|acetabul|pudendal)\b/i.test(name),

  left_arm: (name: string) =>
    isLeft(name) &&
    /\b(humerus|brachii|biceps brachii|triceps brachii|brachialis|coracobrachialis|brachial artery|brachial vein|arm\.l)\b/i.test(name),

  right_arm: (name: string) =>
    isRight(name) &&
    /\b(humerus|brachii|biceps brachii|triceps brachii|brachialis|coracobrachialis|brachial artery|brachial vein|arm\.r)\b/i.test(name),

  left_forearm: (name: string) =>
    isLeft(name) &&
    !/\b(carpal|metacarpal|hand|digit of hand)\b/i.test(name) &&
    /\b(radius|ulna|forearm|brachioradialis|pronator|supinator|radial artery|ulnar artery|radial nerve|ulnar nerve|median nerve|flexor digitorum|extensor digitorum|flexor carpi|extensor carpi|elbow)\b/i.test(name),

  right_forearm: (name: string) =>
    isRight(name) &&
    !/\b(carpal|metacarpal|hand|digit of hand)\b/i.test(name) &&
    /\b(radius|ulna|forearm|brachioradialis|pronator|supinator|radial artery|ulnar artery|radial nerve|ulnar nerve|median nerve|flexor digitorum|extensor digitorum|flexor carpi|extensor carpi|elbow)\b/i.test(name),

  left_hand: (name: string) =>
    isLeft(name) &&
    /\b(hand|wrist|carpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx of hand|thenar|hypothenar|palmar|finger|thumb|digit of hand)\b/i.test(name),

  right_hand: (name: string) =>
    isRight(name) &&
    /\b(hand|wrist|carpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx of hand|thenar|hypothenar|palmar|finger|thumb|digit of hand)\b/i.test(name),

  left_thigh: (name: string) =>
    isLeft(name) &&
    !/\b(patella|knee)\b/i.test(name) &&
    /\b(femur|thigh|quadriceps|rectus femoris|vastus lateralis|vastus medialis|vastus intermedius|hamstring|biceps femoris|semitendinosus|semimembranosus|sartorius|gracilis|adductor|femoral)\b/i.test(name),

  right_thigh: (name: string) =>
    isRight(name) &&
    !/\b(patella|knee)\b/i.test(name) &&
    /\b(femur|thigh|quadriceps|rectus femoris|vastus lateralis|vastus medialis|vastus intermedius|hamstring|biceps femoris|semitendinosus|semimembranosus|sartorius|gracilis|adductor|femoral)\b/i.test(name),

  left_knee: (name: string) =>
    isLeft(name) &&
    /\b(patella|knee|meniscus|cruciate ligament|collateral ligament|popliteal)\b/i.test(name),

  right_knee: (name: string) =>
    isRight(name) &&
    /\b(patella|knee|meniscus|cruciate ligament|collateral ligament|popliteal)\b/i.test(name),

  left_leg: (name: string) =>
    isLeft(name) &&
    !/\b(foot|ankle|talus|calcaneus|tarsal|metatarsal)\b/i.test(name) &&
    /\b(tibia|fibula|shin|calf|crural|gastrocnemius|soleus|tibialis|peroneus|fibularis|leg\.l)\b/i.test(name),

  right_leg: (name: string) =>
    isRight(name) &&
    !/\b(foot|ankle|talus|calcaneus|tarsal|metatarsal)\b/i.test(name) &&
    /\b(tibia|fibula|shin|calf|crural|gastrocnemius|soleus|tibialis|peroneus|fibularis|leg\.r)\b/i.test(name),

  left_foot: (name: string) =>
    isLeft(name) &&
    /\b(foot|ankle|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx of foot|plantar|toe|hallux|digit of foot)\b/i.test(name),

  right_foot: (name: string) =>
    isRight(name) &&
    /\b(foot|ankle|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx of foot|plantar|toe|hallux|digit of foot)\b/i.test(name),
};

/**
 * Given a structure name or za_name, returns which anatomical region it belongs to, or null if unassigned.
 */
export function getRegionForStructure(name: string): string | null {
  for (const [regionId, matcher] of Object.entries(REGION_MATCHERS)) {
    if (matcher(name)) {
      return regionId;
    }
  }
  return null;
}

/**
 * Normalizes any legacy or alias region ID to the canonical 23 region ID
 */
export function normalizeRegionId(id: string): string {
  const direct = ANATOMICAL_REGIONS.find((r) => r.id === id);
  if (direct) return direct.id;
  const aliasMatch = ANATOMICAL_REGIONS.find((r) => r.aliases.includes(id));
  return aliasMatch ? aliasMatch.id : id;
}
