import {useState, useEffect, useRef, useMemo, lazy, Suspense} from 'react';
import {
  useStore,
  type CrewMember,
  type PainArea,
  type WorkoutLogEntry,
} from '../../store';
import {Panel, PageHeader} from '../ui';
import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend} from 'recharts';
import {SPACE_FOOD_DATABASE, NUTRITION_TARGETS, type FoodItem} from '../../data/foods';

const BodyMap3D = lazy(() => import('../ui/BodyMap3D'));

export function Wellness() {
  const role = useStore((s) => s.role);
  const crew = useStore((s) => s.crew);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const linkUp = useStore((s) => s.linkUp);

  const moodLogs = useStore((s) => s.moodLogs);
  const painLogs = useStore((s) => s.painLogs);
  const kitInventory = useStore((s) => s.kitInventory);
  const doseLogs = useStore((s) => s.doseLogs);
  const wellnessHistory = useStore((s) => s.wellnessHistory);
  const painMapMode = useStore((s) => s.painMapMode);
  const setPainMapMode = useStore((s) => s.setPainMapMode);

  // WebGL detection & automatic 2D fallback
  useEffect(() => {
    if (painMapMode === '3d') {
      try {
        const canvas = document.createElement('canvas');
        const hasWebGL = Boolean(
          window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
        if (!hasWebGL) {
          setPainMapMode('2d');
          useStore.getState().addToast('WebGL unavailable in this browser — switched to 2D Body Map', 'warn');
        }
      } catch {
        setPainMapMode('2d');
        useStore.getState().addToast('WebGL unavailable in this browser — switched to 2D Body Map', 'warn');
      }
    }
  }, [painMapMode, setPainMapMode]);

  const logMood = useStore((s) => s.logMood);
  const logPain = useStore((s) => s.logPain);
  const logVision = useStore((s) => s.logVision);
  const logDose = useStore((s) => s.logDose);
  const importKitCSV = useStore((s) => s.importKitCSV);

  // Batch E Additions
  const workoutLogs = useStore((s) => s.workoutLogs);
  const logWorkout = useStore((s) => s.logWorkout);
  const foodLogs = useStore((s) => s.foodLogs);
  const logFood = useStore((s) => s.logFood);
  const companionMessages = useStore((s) => s.companionMessages);
  const sendCompanionMessage = useStore((s) => s.sendCompanionMessage);
  const weeklyGoals = useStore((s) => s.weeklyGoals);
  const toggleWeeklyGoal = useStore((s) => s.toggleWeeklyGoal);
  const updateWeeklyGoalText = useStore((s) => s.updateWeeklyGoalText);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<
    'mood' | 'pain' | 'vision' | 'breathing' | 'meds' | 'history' | 'exercise' | 'nutrition' | 'companion' | 'summary' | 'analytics'
  >('mood');

  // For astronaut, default to Vega; for surgeon, default to selectedCrewId
  const targetMember: CrewMember =
    role === 'astronaut'
      ? crew.find((c) => c.id === 'vega') || crew[0]
      : crew.find((c) => c.id === selectedCrewId) || crew[0];

  const isEditable = role === 'astronaut';

  // --- Sub-Tab 1: Mood State (F030) ---
  const [phq1, setPhq1] = useState(1);
  const [phq2, setPhq2] = useState(0);
  const [gad1, setGad1] = useState(1);
  const [gad2, setGad2] = useState(0);
  const [moodNotes, setMoodNotes] = useState('');

  const phqTotal = phq1 + phq2;
  const gadTotal = gad1 + gad2;
  const isMoodFlagged = phqTotal >= 3 || gadTotal >= 3;

  const handleMoodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logMood(targetMember.id, phqTotal, gadTotal, moodNotes);
    setMoodNotes('');
  };

  // --- Sub-Tab 2: Pain Map State (F032) ---
  const [painView, setPainView] = useState<'front' | 'back'>('front');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('lumbar_spine');
  const [regionSeverity, setRegionSeverity] = useState<number>(3);
  const [activeAreas, setActiveAreas] = useState<PainArea[]>([
    {regionId: 'lumbar_spine', label: 'Lumbar Spine', severity: 4},
  ]);

  const BODY_REGIONS_FRONT = [
    {id: 'head', label: 'Cranium / Head', x: 100, y: 35, r: 18},
    {id: 'neck', label: 'Cervical Spine / Neck', x: 100, y: 64, r: 10},
    {id: 'left_shoulder', label: 'Left Shoulder', x: 62, y: 88, r: 14},
    {id: 'right_shoulder', label: 'Right Shoulder', x: 138, y: 88, r: 14},
    {id: 'chest', label: 'Thorax / Chest', x: 100, y: 98, r: 20},
    {id: 'abdomen', label: 'Abdomen', x: 100, y: 140, r: 18},
    {id: 'left_arm', label: 'Left Upper Arm', x: 44, y: 130, r: 12},
    {id: 'right_arm', label: 'Right Upper Arm', x: 156, y: 130, r: 12},
    {id: 'left_hand', label: 'Left Hand / Wrist', x: 30, y: 180, r: 10},
    {id: 'right_hand', label: 'Right Hand / Wrist', x: 170, y: 180, r: 10},
    {id: 'pelvis', label: 'Pelvis / Hips', x: 100, y: 180, r: 20},
    {id: 'left_thigh', label: 'Left Thigh', x: 80, y: 230, r: 16},
    {id: 'right_thigh', label: 'Right Thigh', x: 120, y: 230, r: 16},
    {id: 'left_leg', label: 'Left Knee / Shin', x: 78, y: 290, r: 14},
    {id: 'right_leg', label: 'Right Knee / Shin', x: 122, y: 290, r: 14},
    {id: 'left_foot', label: 'Left Foot / Ankle', x: 74, y: 345, r: 12},
    {id: 'right_foot', label: 'Right Foot / Ankle', x: 126, y: 345, r: 12},
  ];

  const BODY_REGIONS_BACK = [
    {id: 'head_back', label: 'Occiput / Cranium Back', x: 100, y: 35, r: 18},
    {id: 'neck_back', label: 'Cervical Spine Back', x: 100, y: 64, r: 10},
    {id: 'upper_back', label: 'Upper Back / Thoracic Spine', x: 100, y: 98, r: 20},
    {id: 'lumbar_spine', label: 'Lumbar Spine (L1-S1)', x: 100, y: 145, r: 18},
    {id: 'pelvis_back', label: 'Gluteal / Sacrum', x: 100, y: 185, r: 20},
    {id: 'left_thigh_back', label: 'Left Hamstring', x: 80, y: 230, r: 16},
    {id: 'right_thigh_back', label: 'Right Hamstring', x: 120, y: 230, r: 16},
    {id: 'left_calf', label: 'Left Calf', x: 78, y: 295, r: 14},
    {id: 'right_calf', label: 'Right Calf', x: 122, y: 295, r: 14},
  ];

  const currentRegions = painView === 'front' ? BODY_REGIONS_FRONT : BODY_REGIONS_BACK;

  // 3D and History Overlay State
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('current');

  const memberPainLogs = useMemo(() => {
    return painLogs.filter((p) => p.crewId === targetMember.id);
  }, [painLogs, targetMember.id]);

  const activeHistoryLog = useMemo(() => {
    if (selectedHistoryDate === 'current') return null;
    return memberPainLogs.find((p) => p.id === selectedHistoryDate || p.timeStr === selectedHistoryDate) || null;
  }, [selectedHistoryDate, memberPainLogs]);

  // Effective painted areas (recolours body from historical log if selected)
  const effectiveAreas = useMemo(() => {
    if (activeHistoryLog) {
      return activeHistoryLog.areas;
    }
    return activeAreas;
  }, [activeHistoryLog, activeAreas]);

  const EXTRA_3D_REGIONS = [
    {id: 'left_forearm', label: 'Left Forearm'},
    {id: 'right_forearm', label: 'Right Forearm'},
    {id: 'left_knee', label: 'Left Knee'},
    {id: 'right_knee', label: 'Right Knee'},
    {id: 'left_abdomen', label: 'Left Abdomen'},
    {id: 'right_abdomen', label: 'Right Abdomen'},
  ];

  const ALL_REGIONS = useMemo(() => {
    return [...BODY_REGIONS_FRONT, ...BODY_REGIONS_BACK, ...EXTRA_3D_REGIONS];
  }, [BODY_REGIONS_FRONT, BODY_REGIONS_BACK]);

  const handleRegionClick = (id: string) => {
    setSelectedRegionId(id);
    const existing = effectiveAreas.find((a) => a.regionId === id);
    if (existing) {
      setRegionSeverity(existing.severity);
    } else {
      setRegionSeverity(3);
    }
  };

  const handleAddOrUpdateArea = () => {
    const reg = ALL_REGIONS.find((r) => r.id === selectedRegionId);
    const label = reg ? reg.label : selectedRegionId;

    setActiveAreas((prev) => {
      const idx = prev.findIndex((a) => a.regionId === selectedRegionId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {regionId: selectedRegionId, label, severity: regionSeverity};
        return next;
      }
      return [...prev, {regionId: selectedRegionId, label, severity: regionSeverity}];
    });
  };

  const handleRemoveArea = (id: string) => {
    setActiveAreas((prev) => prev.filter((a) => a.regionId !== id));
  };

  const handleSavePainLog = () => {
    logPain(targetMember.id, activeAreas);
  };

  // --- Sub-Tab 3: Vision State (F072) ---
  const [eSizeIndex, setESizeIndex] = useState(0);
  const [eOrientation, setEOrientation] = useState<'up' | 'down' | 'left' | 'right'>('right');
  const [visionResponses, setVisionResponses] = useState<Array<{size: number; correct: boolean}>>([]);
  const [amslerDistortions, setAmslerDistortions] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const E_SIZES = [
    {label: '20/100 (Snellen 0.2)', px: 48, score: 0.2},
    {label: '20/50 (Snellen 0.4)', px: 32, score: 0.4},
    {label: '20/30 (Snellen 0.67)', px: 22, score: 0.67},
    {label: '20/25 (Snellen 0.8)', px: 16, score: 0.8},
    {label: '20/20 (Snellen 1.0)', px: 12, score: 1.0},
  ];

  // Draw Tumbling E on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0605';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    let angle = 0;
    if (eOrientation === 'up') angle = -Math.PI / 2;
    else if (eOrientation === 'down') angle = Math.PI / 2;
    else if (eOrientation === 'left') angle = Math.PI;
    ctx.rotate(angle);

    const size = E_SIZES[eSizeIndex]?.px || 24;
    ctx.font = `900 ${size}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('E', 0, 0);
    ctx.restore();
  }, [eSizeIndex, eOrientation]);

  const handleEOrientationChoice = (choice: 'up' | 'down' | 'left' | 'right') => {
    const isCorrect = choice === eOrientation;
    const currentScore = E_SIZES[eSizeIndex].score;
    const nextResponses = [...visionResponses, {size: currentScore, correct: isCorrect}];
    setVisionResponses(nextResponses);

    if (eSizeIndex < E_SIZES.length - 1) {
      setESizeIndex((prev) => prev + 1);
      const dirs: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
      setEOrientation(dirs[Math.floor(Math.random() * dirs.length)]);
    } else {
      // Completed all 5 levels - automatically store result to acuity trend
      const correctItems = nextResponses.filter((r) => r.correct);
      const acuity = correctItems.length === 0 ? 0.2 : correctItems[correctItems.length - 1].size;
      logVision(targetMember.id, acuity, amslerDistortions.length);
    }
  };

  const calculateAcuity = () => {
    const correctItems = visionResponses.filter((r) => r.correct);
    if (correctItems.length === 0) return 0.2;
    return correctItems[correctItems.length - 1].size;
  };

  const handleAmslerCellClick = (cellId: string) => {
    setAmslerDistortions((prev) =>
      prev.includes(cellId) ? prev.filter((id) => id !== cellId) : [...prev, cellId]
    );
  };

  const handleSaveVisionLog = () => {
    const acuity = calculateAcuity();
    logVision(targetMember.id, acuity, amslerDistortions.length);
  };

  // --- Sub-Tab 4: Breathing Pacer State (F085) ---
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [phaseSeconds, setPhaseSeconds] = useState(4);
  const [breathCycles, setBreathCycles] = useState(0);

  const initialHrvRef = useRef<number | null>(null);
  const liveHrv = targetMember.readings.hrv[targetMember.readings.hrv.length - 1]?.value ?? targetMember.baseline.hrv;

  useEffect(() => {
    if (!breathingActive) {
      initialHrvRef.current = null;
      return;
    }
    if (initialHrvRef.current === null) {
      initialHrvRef.current = liveHrv;
    }

    const timer = setInterval(() => {
      setPhaseSeconds((prev) => {
        if (prev <= 1) {
          if (breathPhase === 'inhale') {
            setBreathPhase('exhale');
            return 6; // 6s exhale
          } else {
            setBreathPhase('inhale');
            setBreathCycles((c) => c + 1);
            return 4; // 4s inhale
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [breathingActive, breathPhase, liveHrv]);

  const hrvDelta = initialHrvRef.current !== null ? liveHrv - initialHrvRef.current : 0;

  // --- Sub-Tab 5: Medications & Kit State (F034, F009, F075) ---
  const [selectedMed, setSelectedMed] = useState(kitInventory[0]?.name || 'Paracetamol 500mg');
  const [doseQty, setDoseQty] = useState('1 tablet');
  const [csvText, setCsvText] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Check 3 illustrative interaction rules
  const checkInteractions = (newMed: string) => {
    const recentMeds = doseLogs
      .filter((d) => d.crewId === targetMember.id && d.status === 'administered')
      .slice(0, 5)
      .map((d) => d.medicationName);

    const warnings: string[] = [];

    // Rule 1: Ibuprofen + Aspirin
    if (
      (newMed.includes('Ibuprofen') && recentMeds.some((m) => m.includes('Aspirin'))) ||
      (newMed.includes('Aspirin') && recentMeds.some((m) => m.includes('Ibuprofen')))
    ) {
      warnings.push('Illustrative Rule 1: Dual NSAID co-administration (Ibuprofen + Aspirin). Significantly elevates gastrointestinal bleeding risk.');
    }

    // Rule 2: Zolpidem + Promethazine
    if (
      (newMed.includes('Zolpidem') && recentMeds.some((m) => m.includes('Promethazine'))) ||
      (newMed.includes('Promethazine') && recentMeds.some((m) => m.includes('Zolpidem')))
    ) {
      warnings.push('Illustrative Rule 2: CNS depressant synergy (Zolpidem + Promethazine). High risk of deep sedation, ataxia, and respiratory suppression.');
    }

    // Rule 3: Ciprofloxacin + Calcium Carbonate
    if (
      (newMed.includes('Ciprofloxacin') && recentMeds.some((m) => m.includes('Calcium'))) ||
      (newMed.includes('Calcium') && recentMeds.some((m) => m.includes('Ciprofloxacin')))
    ) {
      warnings.push('Illustrative Rule 3: Polyvalent cation chelation (Ciprofloxacin + Calcium Carbonate). Drastically inhibits fluoroquinolone gastrointestinal absorption.');
    }

    return warnings;
  };

  const interactionWarnings = checkInteractions(selectedMed);

  const handleAdministerDose = (e: React.FormEvent) => {
    e.preventDefault();
    logDose(targetMember.id, selectedMed, doseQty);
  };

  const handleImportCSVSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    const res = importKitCSV(csvText);
    if (res.success) {
      setCsvText('');
      setShowCsvModal(false);
    }
  };

  // --- Sub-Tab 7: Exercise Countermeasures State (F024) ---
  const [workoutType, setWorkoutType] = useState<WorkoutLogEntry['type']>('treadmill');
  const [workoutMinutes, setWorkoutMinutes] = useState(45);
  const [workoutIntensity, setWorkoutIntensity] = useState(7);

  const targetWorkouts = workoutLogs.filter((w) => w.crewId === targetMember.id);
  const weeklyWorkoutMinutes = targetWorkouts
    .filter((w) => Date.now() - w.timestamp <= 7 * 86400000)
    .reduce((sum, w) => sum + w.minutes, 0);
  const workoutTargetPct = Math.min(100, Math.round((weeklyWorkoutMinutes / 150) * 100));

  const handleWorkoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logWorkout({
      crewId: targetMember.id,
      type: workoutType,
      minutes: workoutMinutes,
      intensity: workoutIntensity,
    });
  };

  // --- Sub-Tab 8: Nutrition & Hydration State (F026) ---
  const [foodCategoryFilter, setFoodCategoryFilter] = useState<'all' | 'meal' | 'snack' | 'drink' | 'rehydration'>('all');
  const memberFoodLogs = foodLogs.filter((f) => f.crewId === targetMember.id);

  const totalKcal = memberFoodLogs.reduce((s, f) => s + f.kcal, 0);
  const totalProtein = memberFoodLogs.reduce((s, f) => s + f.protein, 0);
  const totalSodium = memberFoodLogs.reduce((s, f) => s + f.sodium, 0);
  const totalFluid = memberFoodLogs.reduce((s, f) => s + f.fluid, 0);

  const handleAddFood = (item: FoodItem) => {
    logFood({
      crewId: targetMember.id,
      foodId: item.id,
      name: item.name,
      kcal: item.kcal,
      protein: item.protein,
      sodium: item.sodium,
      fluid: item.fluid,
    });
  };

  // --- Sub-Tab 9: Autonomous Companion State (F084) ---
  const [companionInput, setCompanionInput] = useState('');
  const companionScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'companion' && companionScrollRef.current) {
      companionScrollRef.current.scrollTop = companionScrollRef.current.scrollHeight;
    }
  }, [companionMessages, activeTab]);

  const handleSendCompanion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companionInput.trim()) return;
    sendCompanionMessage(companionInput.trim());
    setCompanionInput('');
  };

  const handlePromptSelect = (prompt: string) => {
    sendCompanionMessage(prompt);
  };

  // --- Sub-Tab 11: Adherence Analytics Chart Data (F093) ---
  const adherenceAnalyticsData = useMemo(() => {
    const days = ['Sol 136', 'Sol 137', 'Sol 138', 'Sol 139', 'Sol 140', 'Sol 141', 'Sol 142'];
    return days.map((day, idx) => {
      const minutes = idx === 6 ? 45 : [30, 40, 0, 45, 50, 40][idx] ?? 40;
      const hrv = idx === 6 ? Math.round(liveHrv) : [58, 62, 48, 65, 68, 64][idx] ?? 60;
      return {day, minutes, hrv};
    });
  }, [liveHrv]);

  // Helper date formatter for display
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString([], {month: 'short', day: 'numeric'})} · ${d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
  };

  type WellnessGroupId = 'checks' | 'body' | 'lifestyle' | 'records';

  const WELLNESS_GROUPS: Array<{
    id: WellnessGroupId;
    label: string;
    icon: string;
    tabs: Array<{id: typeof activeTab; label: string; icon: string}>;
  }> = [
    {
      id: 'checks',
      label: 'Self-checks',
      icon: '🩺',
      tabs: [
        {id: 'mood', label: 'Mood (PHQ/GAD)', icon: '🧠'},
        {id: 'vision', label: 'Vision Self-Check', icon: '👁️'},
        {id: 'breathing', label: 'Paced Breathing', icon: '🫁'},
      ],
    },
    {
      id: 'body',
      label: 'Body',
      icon: '💪',
      tabs: [
        {id: 'pain', label: 'Pain Map', icon: '🧍'},
        {id: 'exercise', label: 'Exercise (F024)', icon: '🏃'},
        {id: 'nutrition', label: 'Nutrition (F026)', icon: '🥗'},
      ],
    },
    {
      id: 'lifestyle',
      label: 'Lifestyle',
      icon: '🌱',
      tabs: [
        {id: 'companion', label: 'Companion (F084)', icon: '🤖'},
        {id: 'summary', label: 'Weekly Summary (F088)', icon: '📊'},
        {id: 'analytics', label: 'Adherence Analytics (F093)', icon: '📈'},
      ],
    },
    {
      id: 'records',
      label: 'Records',
      icon: '📁',
      tabs: [
        {id: 'meds', label: 'Medications & Kit', icon: '💊'},
        {id: 'history', label: 'Check-In History', icon: '📜'},
      ],
    },
  ];

  const [activeGroup, setActiveGroup] = useState<WellnessGroupId>(() => {
    const found = WELLNESS_GROUPS.find((g) => g.tabs.some((t) => t.id === activeTab));
    return found ? found.id : 'checks';
  });

  const handleGroupSelect = (groupId: WellnessGroupId) => {
    setActiveGroup(groupId);
    const grp = WELLNESS_GROUPS.find((g) => g.id === groupId);
    if (grp && !grp.tabs.some((t) => t.id === activeTab)) {
      setActiveTab(grp.tabs[0].id);
    }
  };

  const currentGroupDef = WELLNESS_GROUPS.find((g) => g.id === activeGroup) || WELLNESS_GROUPS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="W01 OPERATIONAL TELEHEALTH"
        title="Crew wellness & clinical self-checks"
        description={
          role === 'astronaut'
            ? `Personal preventive care suite for Commander ${targetMember.name}. Log daily wellness, map musculoskeletal pain, track exercise, and self-screen vision.`
            : `Flight Surgeon Medical Console: Viewing clinical wellness record for ${targetMember.name} (${targetMember.roleTitle}).`
        }
        actions={
          !isEditable ? (
            <div className="rounded-lg bg-void-2 border border-earth/30 px-3 py-1 font-mono text-xs text-earth flex items-center gap-2">
              <span>👁️</span>
              <span className="font-bold uppercase">Surgeon Read-Only</span>
            </div>
          ) : undefined
        }
      />

      {/* Deep-Space Offline Queue Notice (F039) */}
      {!linkUp && (
        <div className="rounded-lg bg-mars/15 border border-mars/40 p-3.5 font-mono text-xs text-mars flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="animate-pulse">📡</span>
            <span className="font-bold">DEEP-SPACE CARRIER DOWN: Offline queue mode engaged.</span>
            <span className="text-regolith/80 hidden sm:inline">
              Submissions are persisted safely to local IndexedDB with idempotency keys.
            </span>
          </div>
          <span className="rounded bg-mars/20 border border-mars/30 px-2 py-0.5 text-[11px] font-bold">
            QUEUED LOCALLY
          </span>
        </div>
      )}

      {/* Two-Level Tabs: Row 1 = Segmented Groups; Row 2 = Sub-Tabs */}
      <div className="space-y-3" data-tour="ch3-passive-wellness">
        {/* Row 1: Segmented Group Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          {WELLNESS_GROUPS.map((grp) => {
            const isSelected = activeGroup === grp.id;
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => handleGroupSelect(grp.id)}
                className={`rounded-lg px-3 py-2.5 font-bold uppercase transition-all flex items-center justify-center gap-2 min-h-[44px] border ${
                  isSelected
                    ? 'bg-earth text-void border-earth shadow-md'
                    : 'bg-void text-regolith/75 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                <span>{grp.icon}</span>
                <span>{grp.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Selected Group Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 font-mono text-xs">
          {currentGroupDef.tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3.5 py-2 font-bold uppercase transition-colors flex items-center gap-2 min-h-[44px] border ${
                  isTabActive
                    ? 'bg-white/20 text-white border-white/40 shadow-sm'
                    : 'bg-void-2/60 text-regolith/70 border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- TAB 1: MOOD (F030) --- */}
      {activeTab === 'mood' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Panel title="Psychological & Behavioral Health Screening (PHQ-2 & GAD-2)">
              <form onSubmit={handleMoodSubmit} className="space-y-6 font-mono text-xs">
                {/* PHQ-2 Section */}
                <div className="space-y-4 rounded-lg bg-void p-4 border border-white/10">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-white font-bold uppercase text-[11px]">
                      PHQ-2 Depression / Anhedonia Subscale
                    </span>
                    <span className="text-earth font-bold">Subscore: {phqTotal} / 6</span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-regolith/80">
                      1. Over the last 2 weeks, how often have you had little interest or pleasure in doing things?
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly daily (3)'].map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setPhq1(i)}
                          className={`rounded py-2 border transition-colors ${
                            phq1 === i
                              ? 'bg-earth text-void font-bold border-earth'
                              : 'bg-void-2 text-regolith/70 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-regolith/80">
                      2. Feeling down, depressed, or hopeless?
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly daily (3)'].map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setPhq2(i)}
                          className={`rounded py-2 border transition-colors ${
                            phq2 === i
                              ? 'bg-earth text-void font-bold border-earth'
                              : 'bg-void-2 text-regolith/70 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* GAD-2 Section */}
                <div className="space-y-4 rounded-lg bg-void p-4 border border-white/10">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-white font-bold uppercase text-[11px]">
                      GAD-2 Anxiety Subscale
                    </span>
                    <span className="text-earth font-bold">Subscore: {gadTotal} / 6</span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-regolith/80">
                      1. Feeling nervous, anxious, or on edge?
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly daily (3)'].map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setGad1(i)}
                          className={`rounded py-2 border transition-colors ${
                            gad1 === i
                              ? 'bg-earth text-void font-bold border-earth'
                              : 'bg-void-2 text-regolith/70 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-regolith/80">
                      2. Not being able to stop or control worrying?
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly daily (3)'].map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setGad2(i)}
                          className={`rounded py-2 border transition-colors ${
                            gad2 === i
                              ? 'bg-earth text-void font-bold border-earth'
                              : 'bg-void-2 text-regolith/70 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Optional Subjective Notes */}
                <div>
                  <label className="block text-regolith/70 mb-1">
                    Subjective Crew Notes (Optional reflection or context):
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isEditable}
                    value={moodNotes}
                    onChange={(e) => setMoodNotes(e.target.value)}
                    placeholder="Note sleep disruptions, isolation stressors, or mission workload..."
                    className="w-full rounded bg-void border border-white/10 p-2.5 text-white focus:border-earth focus:outline-none"
                  />
                </div>

                {/* Alert Threshold Indicator */}
                {isMoodFlagged && (
                  <div className="rounded bg-mars/15 border border-mars/40 p-3 text-mars flex items-center gap-2">
                    <span>⚠️</span>
                    <span>
                      Total score &ge; 3 triggers behavioral support recommendation and asynchronous notification to ground flight surgeon.
                    </span>
                  </div>
                )}

                {isEditable && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded bg-earth px-6 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                    >
                      Record Mood Check-In
                    </button>
                  </div>
                )}
              </form>
            </Panel>
          </div>

          {/* Right Column: Mood Trend Chart */}
          <div className="space-y-6">
            <Panel title="Historical Behavioral Trends">
              <div className="h-[220px] sm:h-64 font-mono text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...moodLogs].reverse()}>
                    <XAxis dataKey="timeStr" stroke="#8b909b" fontSize={9} />
                    <YAxis domain={[0, 6]} stroke="#8b909b" fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="phqScore" stroke="#e2704a" strokeWidth={2} name="PHQ-2" dot={{r: 3}} />
                    <Line type="monotone" dataKey="gadScore" stroke="#6fb6ff" strokeWidth={2} name="GAD-2" dot={{r: 3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 space-y-2 border-t border-white/10 pt-3 font-mono text-xs text-regolith/70">
                <div className="flex justify-between">
                  <span>Threshold Cutoff:</span>
                  <span className="text-mars font-bold">&ge; 3 / 6 (Subscale)</span>
                </div>
                <div className="flex justify-between">
                  <span>Ground Escalation:</span>
                  <span className="text-white">Asynchronous Dr. Priya Nair Review</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- TAB 2: PAIN MAP (F032) --- */}
      {activeTab === 'pain' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Anatomical Silhouette / 3D Body Map */}
          <div className="lg:col-span-6 space-y-4">
            <Panel
              title="Anatomical Body Map"
              rightAction={
                <div className="flex flex-wrap items-center gap-2">
                  {/* Historical Date Overlay Selector */}
                  {memberPainLogs.length > 0 && (
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="text-regolith/50 hidden sm:inline">Log:</span>
                      <select
                        value={selectedHistoryDate}
                        onChange={(e) => setSelectedHistoryDate(e.target.value)}
                        className="rounded bg-void border border-white/10 px-2 py-1 text-regolith/80 focus:border-earth focus:outline-none"
                      >
                        <option value="current">● Current Active</option>
                        {memberPainLogs.map((log) => (
                          <option key={log.id} value={log.id}>
                            🕒 {log.timeStr}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 2D | 3D Mode Toggle (Default 3D, stored in store) */}
                  <div className="flex items-center rounded border border-white/10 bg-void p-0.5 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setPainMapMode('3d')}
                      className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                        painMapMode === '3d' ? 'bg-earth text-void' : 'text-regolith/60 hover:text-white'
                      }`}
                    >
                      3D
                    </button>
                    <button
                      type="button"
                      onClick={() => setPainMapMode('2d')}
                      className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                        painMapMode === '2d' ? 'bg-earth text-void' : 'text-regolith/60 hover:text-white'
                      }`}
                    >
                      2D
                    </button>
                  </div>
                </div>
              }
            >
              {/* Historical Overlay Banner */}
              {activeHistoryLog && (
                <div className="mb-3 rounded bg-earth/10 border border-earth/30 px-3 py-2 text-[11px] font-mono text-earth flex items-center justify-between">
                  <span>
                    Viewing past pain record: <strong>{activeHistoryLog.timeStr}</strong> ({activeHistoryLog.areas.length} marked regions).
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryDate('current')}
                    className="underline text-white font-bold hover:text-earth ml-2 shrink-0"
                  >
                    Return to Active
                  </button>
                </div>
              )}

              {painMapMode === '3d' ? (
                <Suspense
                  fallback={
                    <div className="h-[360px] lg:h-[520px] flex flex-col items-center justify-center font-mono text-xs text-regolith/50 bg-void rounded-xl border border-white/10">
                      <span className="size-2 rounded-full bg-earth animate-pulse mb-2" />
                      Loading 3D Anatomy Model...
                    </div>
                  }
                >
                  <BodyMap3D
                    selectedRegionId={selectedRegionId}
                    onSelectRegion={handleRegionClick}
                    activeAreas={effectiveAreas}
                    readOnly={!isEditable || Boolean(activeHistoryLog)}
                    onFallback2D={() => setPainMapMode('2d')}
                  />
                </Suspense>
              ) : (
                <>
                  <div className="flex justify-center gap-2 mb-3 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setPainView('front')}
                      className={`rounded px-4 py-1.5 uppercase font-bold transition-colors ${
                        painView === 'front' ? 'bg-earth text-void' : 'bg-void text-regolith/70 border border-white/10'
                      }`}
                    >
                      Anterior (Front)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPainView('back')}
                      className={`rounded px-4 py-1.5 uppercase font-bold transition-colors ${
                        painView === 'back' ? 'bg-earth text-void' : 'bg-void text-regolith/70 border border-white/10'
                      }`}
                    >
                      Posterior (Back)
                    </button>
                  </div>

                  <div className="relative mx-auto flex justify-center bg-void rounded-xl p-4 border border-white/10">
                    <svg viewBox="0 0 200 390" className="w-56 h-[380px]">
                      {/* Silhouette outline */}
                      <path
                        d={
                          painView === 'front'
                            ? 'M100 15 C85 15 82 32 82 45 C82 58 90 65 92 68 C75 74 55 82 45 95 C35 110 30 160 25 185 C23 192 28 195 32 190 C38 175 42 140 48 128 C52 145 52 175 60 190 C68 205 70 215 72 240 C75 270 72 310 70 340 C68 358 80 360 82 348 C85 325 88 285 92 250 C95 220 98 220 100 220 C102 220 105 220 108 250 C112 285 115 325 118 348 C120 360 132 358 130 340 C128 310 125 270 128 240 C130 215 132 205 140 190 C148 175 148 145 152 128 C158 140 162 175 168 190 C172 195 177 192 175 185 C170 160 165 110 155 95 C145 82 125 74 108 68 C110 65 118 58 118 45 C118 32 115 15 100 15 Z'
                            : 'M100 15 C85 15 82 32 82 45 C82 58 90 65 92 68 C75 74 55 82 45 95 C35 110 30 160 25 185 C23 192 28 195 32 190 C38 175 42 140 48 128 C52 145 52 175 60 190 C68 205 70 215 72 240 C75 270 72 310 70 340 C68 358 80 360 82 348 C85 325 88 285 92 250 C95 220 98 220 100 220 C102 220 105 220 108 250 C112 285 115 325 118 348 C120 360 132 358 130 340 C128 310 125 270 128 240 C130 215 132 205 140 190 C148 175 148 145 152 128 C158 140 162 175 168 190 C172 195 177 192 175 185 C170 160 165 110 155 95 C145 82 125 74 108 68 C110 65 118 58 118 45 C118 32 115 15 100 15 Z'
                        }
                        fill="#140b08"
                        stroke="#a0786a"
                        strokeWidth="1.5"
                      />

                      {/* Anatomical touch target hotspots */}
                      {currentRegions.map((region) => {
                        const activeArea = effectiveAreas.find((a) => a.regionId === region.id);
                        const isSelected = selectedRegionId === region.id;
                        const sev = activeArea?.severity ?? 0;

                        let fill = 'rgba(255, 255, 255, 0.05)';
                        if (sev >= 7) fill = 'rgba(226, 112, 74, 0.85)';
                        else if (sev >= 4) fill = 'rgba(224, 176, 58, 0.75)';
                        else if (sev > 0) fill = 'rgba(111, 182, 255, 0.7)';

                        return (
                          <g key={region.id} className="cursor-pointer" onClick={() => handleRegionClick(region.id)}>
                            <circle
                              cx={region.x}
                              cy={region.y}
                              r={region.r}
                              fill={fill}
                              stroke={isSelected ? '#6fb6ff' : 'rgba(255,255,255,0.2)'}
                              strokeWidth={isSelected ? 2 : 1}
                              className="transition-all hover:stroke-white"
                            />
                            {sev > 0 && (
                              <text
                                x={region.x}
                                y={region.y + 4}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="10"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {sev}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </>
              )}
            </Panel>
          </div>

          {/* Region Editor & Active Pain List */}
          <div className="lg:col-span-6 space-y-6">
            <Panel title="Pain Intensity & Region Specification">
              <div className="space-y-4 font-mono text-xs">
                <div>
                  <span className="text-regolith/50 text-[11px] uppercase block">Selected Anatomical Target:</span>
                  <span className="text-white font-bold text-sm">
                    {ALL_REGIONS.find((r) => r.id === selectedRegionId)?.label || selectedRegionId || 'Tap a hotspot on body map'}
                  </span>
                </div>

                <div className="space-y-2 rounded-lg bg-void p-3.5 border border-white/10">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-regolith/70 uppercase">Pain Severity (0 - 10 Scale):</span>
                    <span className="text-mars font-bold text-sm">{regionSeverity} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={!isEditable}
                    value={regionSeverity}
                    onChange={(e) => setRegionSeverity(+e.target.value)}
                    className="w-full accent-mars"
                  />
                  <div className="flex justify-between text-[11px] text-regolith/50">
                    <span>1: Mild ache</span>
                    <span>5: Moderate pain</span>
                    <span>10: Incapacitating</span>
                  </div>
                </div>

                {isEditable && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddOrUpdateArea}
                      className="rounded bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 font-bold uppercase text-white transition-colors"
                    >
                      Set Region Pain
                    </button>
                    {activeAreas.some((a) => a.regionId === selectedRegionId) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveArea(selectedRegionId)}
                        className="rounded bg-mars/20 hover:bg-mars/30 border border-mars/40 px-3 py-2 font-bold uppercase text-mars transition-colors"
                      >
                        Clear Area
                      </button>
                    )}
                  </div>
                )}

                {/* Active Areas Summary */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <span className="text-white font-bold text-[11px] uppercase block">
                    {activeHistoryLog
                      ? `Historical Logged Pain Regions (${activeHistoryLog.timeStr}):`
                      : 'Active Logged Pain Regions:'}
                  </span>
                  {effectiveAreas.length === 0 ? (
                    <p className="text-regolith/50 text-[11px]">No active pain points marked.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {effectiveAreas.map((area) => (
                        <div
                          key={area.regionId}
                          className="flex items-center justify-between rounded bg-void p-2.5 border border-white/5"
                        >
                          <div>
                            <span className="font-bold text-white">{area.label}</span>
                            <span className="text-regolith/50 ml-2">Severity: {area.severity}/10</span>
                          </div>
                          {isEditable && !activeHistoryLog && (
                            <button
                              type="button"
                              onClick={() => handleRemoveArea(area.regionId)}
                              className="text-mars text-[11px] hover:underline"
                            >
                              Remove ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isEditable && (
                  <div className="pt-3 border-t border-white/10 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSavePainLog}
                      className="rounded bg-earth px-6 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                    >
                      Save Pain Log to Clinical Record
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- TAB 3: VISION SELF-CHECK (F072) --- */}
      {activeTab === 'vision' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tumbling E Acuity Test Canvas */}
          <Panel title="Tumbling-E Visual Acuity Screening (SANS Monitoring)">
            <div className="space-y-4 font-mono text-xs">
              <div className="flex justify-between items-center text-[11px] text-regolith/70">
                <span>Test Level {eSizeIndex + 1} of 5</span>
                <span className="text-earth font-bold">{E_SIZES[eSizeIndex]?.label}</span>
              </div>

              <div className="flex justify-center bg-void rounded-xl p-6 border border-white/10">
                <canvas ref={canvasRef} width={200} height={160} className="rounded bg-[#0a0605]" />
              </div>

              <div className="text-center space-y-2">
                <p className="text-regolith/80 text-[11px]">Which direction are the prongs of the E pointing?</p>
                <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
                  {(['up', 'left', 'down', 'right'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      disabled={!isEditable}
                      onClick={() => handleEOrientationChoice(dir)}
                      className="rounded bg-void-2 border border-white/20 py-2.5 font-bold uppercase text-white hover:bg-earth hover:text-void transition-colors"
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between text-[11px]">
                <span className="text-regolith/50">Calculated Acuity Score:</span>
                <span className="text-white font-bold">{calculateAcuity().toFixed(2)} Snellen Equiv</span>
              </div>
            </div>
          </Panel>

          {/* Amsler Grid Distortion Test */}
          <Panel title="Amsler Grid Metamorphopsia Check">
            <div className="space-y-4 font-mono text-xs">
              <p className="text-regolith/75 text-[11px]">
                Fixate on the center point. Tap any grid squares where lines appear curved, wavy, or missing.
              </p>

              <div className="flex justify-center">
                <div className="grid grid-cols-5 gap-0.5 bg-white/20 p-1 rounded border border-white/30">
                  {Array.from({length: 25}, (_, i) => {
                    const cellId = `cell-${i}`;
                    const isCenter = i === 12;
                    const isMarked = amslerDistortions.includes(cellId);

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!isEditable}
                        onClick={() => handleAmslerCellClick(cellId)}
                        className={`size-10 sm:size-12 flex items-center justify-center border border-white/15 transition-colors ${
                          isMarked
                            ? 'bg-mars text-white font-bold'
                            : isCenter
                            ? 'bg-earth/40 text-earth font-bold'
                            : 'bg-void hover:bg-white/10'
                        }`}
                      >
                        {isCenter ? '●' : isMarked ? '✕' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[11px]">
                <span className="text-regolith/50">Marked Distortions:</span>
                <span className={amslerDistortions.length > 0 ? 'text-mars font-bold' : 'text-emerald-400 font-bold'}>
                  {amslerDistortions.length} Scatoma / Wave Regions
                </span>
              </div>

              {isEditable && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveVisionLog}
                    className="rounded bg-earth px-5 py-2 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                  >
                    Save Vision Screening
                  </button>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 4: PACED BREATHING (F085) --- */}
      {activeTab === 'breathing' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Autonomic Paced Respiration Trainer (Vagal Activation)">
            <div className="space-y-6 font-mono text-xs text-center py-4">
              <div className="relative mx-auto size-48 flex items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full border-4 transition-all duration-1000 ${
                    breathPhase === 'inhale' ? 'border-earth scale-110 bg-earth/10' : 'border-mars scale-90 bg-mars/10'
                  }`}
                />
                <div className="space-y-1 z-10">
                  <span className="text-white font-bold text-xl uppercase block">{breathPhase}</span>
                  <span className="text-3xl font-display text-white font-bold">{phaseSeconds}s</span>
                  <span className="text-[11px] text-regolith/50 block">Cycle {breathCycles}</span>
                </div>
              </div>

              <p className="text-regolith/75 text-[11px] max-w-sm mx-auto">
                4-second nasal inhalation followed by 6-second pursed-lip exhalation. Stimulates vagus nerve and restores autonomic HRV balance.
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => setBreathingActive((v) => !v)}
                  className={`rounded px-6 py-2.5 font-bold uppercase transition-colors shadow ${
                    breathingActive ? 'bg-mars text-white' : 'bg-earth text-void hover:bg-earth/90'
                  }`}
                >
                  {breathingActive ? 'Stop Respiration Pacer' : 'Begin 4s/6s Paced Breathing'}
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Autonomic Tone (HRV) Response Delta">
            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded bg-void p-3 border border-white/10">
                  <span className="text-[11px] text-regolith/50 uppercase block">Live HRV (RMSSD)</span>
                  <span className="text-white font-bold text-base">{Math.round(liveHrv)} ms</span>
                </div>
                <div className="rounded bg-void p-3 border border-white/10">
                  <span className="text-[11px] text-regolith/50 uppercase block">Session Delta</span>
                  <span className={`font-bold text-base ${hrvDelta >= 0 ? 'text-emerald-400' : 'text-mars'}`}>
                    {hrvDelta >= 0 ? `+${hrvDelta.toFixed(1)}` : hrvDelta.toFixed(1)} ms
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-void-2 p-4 border border-white/10 space-y-2">
                <span className="font-bold text-white text-[11px] uppercase block">Cardiovascular Autonomic Coupling</span>
                <p className="text-regolith/80 text-[11px] leading-relaxed">
                  Deep space microgravity reduces cardiovascular baroreflex sensitivity. A 5-minute paced breathing cycle raises HRV by an average of +12ms, offsetting cephalad congestion sympathetic spikes.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 5: MEDICATIONS & KIT (F034, F009, F075) --- */}
      {activeTab === 'meds' && (
        <div className="space-y-6">
          {/* Dose Administration Guard Form */}
          {isEditable && (
            <Panel title="Log Medication Dose (Interplanetary Guardrails)">
              <form onSubmit={handleAdministerDose} className="space-y-4 font-mono text-xs">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-regolith/70 mb-1">Select Medication from Kit:</label>
                    <select
                      value={selectedMed}
                      onChange={(e) => setSelectedMed(e.target.value)}
                      className="w-full rounded bg-void border border-white/20 p-2.5 text-white focus:border-earth focus:outline-none"
                    >
                      {kitInventory.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name} ({item.quantity} {item.unit} available)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-regolith/70 mb-1">Dose & Unit:</label>
                    <input
                      type="text"
                      value={doseQty}
                      onChange={(e) => setDoseQty(e.target.value)}
                      placeholder="e.g. 1 tablet, 500 mg, 1 puff"
                      className="w-full rounded bg-void border border-white/20 p-2.5 text-white focus:border-earth focus:outline-none"
                    />
                  </div>
                </div>

                {/* Interaction Guardrail Warnings */}
                {interactionWarnings.length > 0 && (
                  <div className="rounded-lg bg-mars/15 border border-mars/40 p-3 text-mars space-y-1">
                    {interactionWarnings.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span>⚠️</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded bg-earth px-6 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                  >
                    Administer & Record Dose
                  </button>
                </div>
              </form>
            </Panel>
          )}

          {/* Kit Inventory Table */}
          <Panel title="Deep-Space Medical Kit Inventory">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-regolith/50 uppercase">
                  {kitInventory.length} Tracked Pharmaceuticals & Consumables
                </span>
                <button
                  type="button"
                  onClick={() => setShowCsvModal(true)}
                  className="rounded bg-void border border-white/20 px-3 py-1 text-[11px] text-white hover:border-earth uppercase"
                >
                  📥 Import Kit CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-regolith/50 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">In Stock</th>
                      <th className="py-2.5 px-5 text-right whitespace-nowrap">Min Stock</th>
                      <th className="py-2.5 px-5 whitespace-nowrap">Expiry Date</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white">
                    {kitInventory.map((item) => {
                      const isLow = item.quantity <= item.minThreshold;
                      const isExpired = new Date(item.expiryDate) < new Date();

                      return (
                        <tr key={item.id} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 font-bold">{item.name}</td>
                          <td className="py-2.5 px-3 text-regolith/70">{item.category}</td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2.5 px-5 text-right text-regolith/50 whitespace-nowrap">
                            {item.minThreshold} {item.unit}
                          </td>
                          <td className="py-2.5 px-5 text-regolith/70 whitespace-nowrap">{item.expiryDate}</td>
                          <td className="py-2.5 px-3 text-right">
                            {isExpired ? (
                              <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 text-[11px] font-bold uppercase">
                                EXPIRED
                              </span>
                            ) : isLow ? (
                              <span className="rounded bg-[#e0b03a]/20 text-[#e0b03a] border border-[#e0b03a]/40 px-2 py-0.5 text-[11px] font-bold uppercase">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold uppercase">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          {/* Dose Administration Log */}
          {doseLogs.length > 0 && (
            <Panel title="Recent Administration & Guard Log">
              <div className="space-y-2">
                {doseLogs.map((d) => (
                  <div
                    key={d.id}
                    className={`rounded p-3 border flex items-center justify-between text-xs ${
                      d.status === 'blocked'
                        ? 'bg-mars/10 border-mars/30 text-mars'
                        : 'bg-void border-white/10 text-white'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{d.medicationName} ({d.dose})</span>
                      <p className="text-[11px] text-regolith/60">{d.notes || 'Administered normally'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold uppercase text-[11px]">[{d.status}]</span>
                      <span className="block text-[11px] text-regolith/50">{d.timeStr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* CSV Import Modal */}
          {showCsvModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-void-2 border border-white/20 p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <h3 className="font-display text-sm text-white font-bold uppercase">
                    Import Medical Kit Inventory CSV
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCsvModal(false)}
                    className="text-regolith/50 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleImportCSVSubmit} className="space-y-3">
                  <p className="text-regolith/70 text-[11px]">
                    Paste CSV text with header: <code>name,category,quantity,unit,minThreshold,expiryDate</code>
                  </p>

                  <textarea
                    rows={6}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder={`name,category,quantity,unit,minThreshold,expiryDate\nHydrocortisone 1%,Analgesic,10,tubes,2,2028-12-31\nAmoxicillin 500mg,Antibiotic,30,capsules,10,2027-04-15`}
                    className="w-full rounded bg-void border border-white/15 p-3 text-white font-mono text-xs focus:border-earth focus:outline-none"
                  />

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCsvModal(false)}
                      className="rounded bg-white/10 px-4 py-2 font-bold uppercase text-regolith hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded bg-earth px-5 py-2 font-bold uppercase text-void hover:bg-earth/90"
                    >
                      Parse & Import
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 6: HISTORY (Check-In Log) --- */}
      {activeTab === 'history' && (
        <Panel title="Historical Crew Check-Ins & Telemetry Log">
          <div className="space-y-3 font-mono text-xs">
            {wellnessHistory.length === 0 ? (
              <p className="text-regolith/50 text-[11px]">No check-in submissions recorded yet.</p>
            ) : (
              wellnessHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-void p-3.5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white uppercase font-bold">
                        {item.type}
                      </span>
                      <span className="font-bold text-white">{item.summary}</span>
                    </div>
                    <p className="text-[11px] text-regolith/60">
                      ID: {item.id} · Subject: {crew.find((c) => c.id === item.crewId)?.name || item.crewId}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between text-[11px]">
                    <span className="text-regolith/50">{item.timeStr || formatDate(item.timestamp)}</span>
                    {item.status === 'pending' ? (
                      <span className="rounded bg-mars/20 text-mars border border-mars/30 px-2 py-0.5 font-bold uppercase mt-1">
                        ⏳ Pending Sync
                      </span>
                    ) : (
                      <span className="rounded bg-earth/20 text-earth border border-earth/30 px-2 py-0.5 font-bold uppercase mt-1">
                        ● Synced to Ground
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      )}

      {/* --- TAB 7: EXERCISE COUNTERMEASURES (F024) --- */}
      {activeTab === 'exercise' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Workout Logging Form */}
          <div className="lg:col-span-5 space-y-6">
            <Panel title="Countermeasure Session Logging (F024)">
              <form onSubmit={handleWorkoutSubmit} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-regolith/70 mb-1">Equipment / Exercise Modality:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['treadmill', 'resistive', 'cycle'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!isEditable}
                        onClick={() => setWorkoutType(t)}
                        className={`rounded py-2 uppercase font-bold border transition-colors ${
                          workoutType === t
                            ? 'bg-earth text-void border-earth'
                            : 'bg-void text-regolith/70 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg bg-void p-3.5 border border-white/10">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-regolith/70 uppercase">Duration:</span>
                    <span className="text-white font-bold">{workoutMinutes} minutes</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="120"
                    step="5"
                    disabled={!isEditable}
                    value={workoutMinutes}
                    onChange={(e) => setWorkoutMinutes(+e.target.value)}
                    className="w-full accent-earth"
                  />
                  <div className="flex justify-between text-[11px] text-regolith/50">
                    <span>15 min</span>
                    <span>60 min</span>
                    <span>120 min</span>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg bg-void p-3.5 border border-white/10">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-regolith/70 uppercase">Exertion Intensity (1 - 10):</span>
                    <span className="text-mars font-bold">{workoutIntensity} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={!isEditable}
                    value={workoutIntensity}
                    onChange={(e) => setWorkoutIntensity(+e.target.value)}
                    className="w-full accent-mars"
                  />
                </div>

                {isEditable && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="rounded bg-earth px-6 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                    >
                      Record Countermeasure Log
                    </button>
                  </div>
                )}
              </form>
            </Panel>
          </div>

          {/* Weekly Target Progress & History */}
          <div className="lg:col-span-7 space-y-6">
            <Panel title="Weekly Countermeasure Discipline (150m Target)">
              <div className="space-y-5 font-mono text-xs">
                {/* Progress bar and metrics */}
                <div className="rounded-xl bg-void p-4 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-white uppercase">Weekly Exertion Volume</span>
                    <span className="text-earth">{weeklyWorkoutMinutes} / 150 min ({workoutTargetPct}%)</span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        workoutTargetPct >= 100 ? 'bg-emerald-400' : 'bg-earth'
                      }`}
                      style={{width: `${workoutTargetPct}%`}}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-regolith/50 pt-1">
                    <span>Target: 150 min (NASA Standard Countermeasure Protocol)</span>
                    <span className={workoutTargetPct >= 100 ? 'text-emerald-400 font-bold' : 'text-regolith/60'}>
                      {workoutTargetPct >= 100 ? '✓ Goal Achieved' : `${150 - weeklyWorkoutMinutes} min remaining`}
                    </span>
                  </div>
                </div>

                {/* Workout History Table */}
                <div className="space-y-2">
                  <span className="text-white font-bold text-[11px] uppercase block">Logged Sessions:</span>
                  {targetWorkouts.length === 0 ? (
                    <p className="text-regolith/50 text-[11px]">No workouts logged yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {targetWorkouts.map((w) => (
                        <div
                          key={w.id}
                          className="rounded-lg bg-void p-3 border border-white/10 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-white uppercase text-xs">
                              {w.type} ({w.minutes} min)
                            </span>
                            <span className="text-[11px] text-regolith/60 ml-3">Intensity: {w.intensity}/10</span>
                          </div>
                          <span className="text-[11px] text-regolith/50">{w.timeStr}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- TAB 8: NUTRITION & HYDRATION (F026) --- */}
      {activeTab === 'nutrition' && (
        <div className="space-y-6">
          {/* Daily Progress Bars */}
          <Panel title="Daily Nutritional & Fluid Budget">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
              <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-regolith/70 uppercase">Energy</span>
                  <span className="text-white font-bold">{totalKcal} / {NUTRITION_TARGETS.kcal} kcal</span>
                </div>
                <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-mars rounded"
                    style={{width: `${Math.min(100, Math.round((totalKcal / NUTRITION_TARGETS.kcal) * 100))}%`}}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-regolith/70 uppercase">Protein</span>
                  <span className="text-white font-bold">{totalProtein} / {NUTRITION_TARGETS.protein} g</span>
                </div>
                <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-earth rounded"
                    style={{width: `${Math.min(100, Math.round((totalProtein / NUTRITION_TARGETS.protein) * 100))}%`}}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-regolith/70 uppercase">Sodium Buffer</span>
                  <span className={`font-bold ${totalSodium > NUTRITION_TARGETS.sodium ? 'text-mars' : 'text-white'}`}>
                    {totalSodium} / {NUTRITION_TARGETS.sodium} mg
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded ${totalSodium > NUTRITION_TARGETS.sodium ? 'bg-mars' : 'bg-[#e0b03a]'}`}
                    style={{width: `${Math.min(100, Math.round((totalSodium / NUTRITION_TARGETS.sodium) * 100))}%`}}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-regolith/70 uppercase">Hydration Volume</span>
                  <span className="text-white font-bold">{(totalFluid / 1000).toFixed(1)} / {(NUTRITION_TARGETS.fluid / 1000).toFixed(1)} L</span>
                </div>
                <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-earth rounded"
                    style={{width: `${Math.min(100, Math.round((totalFluid / NUTRITION_TARGETS.fluid) * 100))}%`}}
                  />
                </div>
              </div>
            </div>
          </Panel>

          {/* Quick-Add Spaceflight Menu */}
          <Panel
            title="Spaceflight Nutrition Menu (Quick-Add Database)"
            rightAction={
              <div className="flex gap-1 font-mono text-[11px]">
                {(['all', 'meal', 'snack', 'drink', 'rehydration'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFoodCategoryFilter(cat)}
                    className={`rounded px-2.5 py-0.5 uppercase transition-colors ${
                      foodCategoryFilter === cat ? 'bg-white/20 text-white font-bold' : 'text-regolith/60 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 font-mono text-xs">
              {SPACE_FOOD_DATABASE.filter((item) => foodCategoryFilter === 'all' || item.category === foodCategoryFilter).map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-void p-3.5 border border-white/10 flex flex-col justify-between space-y-3 hover:border-white/25 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <h5 className="font-bold text-white text-xs leading-tight">{item.name}</h5>
                          <span className="text-[11px] text-regolith/50">{item.portion}</span>
                        </div>
                      </div>
                      <span className="text-[11px] rounded bg-white/10 px-1.5 py-0.5 uppercase text-regolith font-bold">
                        {item.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[11px] text-regolith/70 pt-2 border-t border-white/5">
                      <div>
                        <span className="block text-regolith/40">KCAL</span>
                        <span className="text-white font-medium">{item.kcal}</span>
                      </div>
                      <div>
                        <span className="block text-regolith/40">PROT</span>
                        <span className="text-white font-medium">{item.protein}g</span>
                      </div>
                      <div>
                        <span className="block text-regolith/40">NA</span>
                        <span className="text-white font-medium">{item.sodium}mg</span>
                      </div>
                      <div>
                        <span className="block text-regolith/40">FLUID</span>
                        <span className="text-white font-medium">{item.fluid}mL</span>
                      </div>
                    </div>

                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => handleAddFood(item)}
                        className="w-full rounded bg-white/10 hover:bg-earth hover:text-void py-1.5 text-[11px] uppercase font-bold text-white transition-colors"
                      >
                        + Add to Day
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 9: AUTONOMOUS COMPANION (F084) --- */}
      {activeTab === 'companion' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-void-2 p-3.5 border border-white/10 font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🤖</span>
              <span className="text-regolith/80">
                Supportive companion, not a therapist. Private, non-clinical psychological reflection.
              </span>
            </div>
            <span className="rounded bg-earth/20 text-earth border border-earth/30 px-2 py-0.5 text-[11px] font-bold uppercase">
              CONFIDENTIAL IN-QUARTERS
            </span>
          </div>

          <Panel title="Personal Decompression & Reflection Console">
            <div className="space-y-4 font-mono text-xs">
              {/* Chat Thread */}
              <div
                ref={companionScrollRef}
                className="space-y-3 max-h-[380px] overflow-y-auto pr-2 p-3 bg-void rounded-xl border border-white/10"
              >
                {companionMessages.map((msg) => {
                  const isUser = msg.sender === 'crew';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl p-3.5 leading-relaxed font-sans text-xs ${
                          isUser
                            ? 'bg-earth text-void font-medium'
                            : msg.isCrisis
                            ? 'bg-mars/20 border-2 border-mars text-white'
                            : 'bg-void-2 border border-white/15 text-white'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.isCrisis && (
                          <div className="mt-2 pt-2 border-t border-mars/40 text-[11px] font-mono text-mars font-bold flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>Crisis Sentinel Triggered: Flight surgeon notified for review.</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-regolith/40 mt-1 px-1">
                        {isUser ? 'Elena Vega' : 'Companion AI'} · {msg.timeStr}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reflection Suggestion Prompts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-regolith/50 uppercase">Suggested Prompts:</span>
                {[
                  'Feeling tired after the sleep shift',
                  'Missing family and Earth',
                  'Workload feels high today',
                  'Dealing with persistent back ache',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePromptSelect(prompt)}
                    className="rounded bg-white/5 hover:bg-white/15 border border-white/10 px-2.5 py-1 text-[11px] text-regolith/80 hover:text-white transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Message Input Box */}
              <form onSubmit={handleSendCompanion} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Share how you are feeling or what is on your mind..."
                  value={companionInput}
                  onChange={(e) => setCompanionInput(e.target.value)}
                  className="flex-1 rounded bg-void border border-white/15 p-2.5 text-white focus:border-earth focus:outline-none text-xs"
                />
                <button
                  type="submit"
                  className="rounded bg-earth px-5 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                >
                  Send
                </button>
              </form>
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 10: WEEKLY SUMMARY (F088) --- */}
      {activeTab === 'summary' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Digest Metrics */}
          <Panel title="Weekly Telehealth Performance Digest">
            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-1">
                  <span className="text-[11px] text-regolith/50 uppercase block">Exercise Target</span>
                  <span className="text-earth font-bold text-base">{weeklyWorkoutMinutes} / 150m</span>
                  <span className="text-[11px] text-regolith/50 block">Discipline compliance</span>
                </div>
                <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-1">
                  <span className="text-[11px] text-regolith/50 uppercase block">Hydration Target</span>
                  <span className="text-white font-bold text-base">{(totalFluid / 1000).toFixed(1)} / 2.5L</span>
                  <span className="text-[11px] text-regolith/50 block">Daily plasma volume buffer</span>
                </div>
                <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-1">
                  <span className="text-[11px] text-regolith/50 uppercase block">Check-In Cadence</span>
                  <span className="text-white font-bold text-base">
                    {wellnessHistory.filter((w) => w.crewId === targetMember.id).length} recorded
                  </span>
                  <span className="text-[11px] text-regolith/50 block">Self-report surveillance</span>
                </div>
                <div className="rounded-xl bg-void p-3.5 border border-white/10 space-y-1">
                  <span className="text-[11px] text-regolith/50 uppercase block">Composite Adherence</span>
                  <span className="text-emerald-400 font-bold text-base">92% Nominal</span>
                  <span className="text-[11px] text-emerald-300 block">Autonomic balance stable</span>
                </div>
              </div>

              <div className="rounded-xl bg-void-2 p-4 border border-white/10 space-y-2">
                <span className="font-bold text-white uppercase text-xs">Physician Review Annotation</span>
                <p className="text-regolith/80 text-[11px] leading-relaxed">
                  Commander Vega maintains high countermeasure adherence. Transient lumbar elongation pain is stabilizing with traction stretches. No SANS optic disc edema detected.
                </p>
                <div className="pt-2 border-t border-white/5 flex justify-between text-[11px] text-regolith/50">
                  <span>Ground Flight Surgeon:</span>
                  <span className="text-white">Dr. Priya Nair (Houston)</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Editable Weekly Goals */}
          <Panel title="Weekly Health & Resilience Goals (F088)">
            <div className="space-y-4 font-mono text-xs">
              <p className="text-regolith/70 text-[11px]">
                Check off achieved milestones or edit personal weekly targets below:
              </p>

              <div className="space-y-3">
                {weeklyGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="rounded-xl bg-void p-3.5 border border-white/10 flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={goal.completed}
                      disabled={!isEditable}
                      onChange={() => toggleWeeklyGoal(goal.id)}
                      className="size-4 mt-0.5 accent-earth cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={goal.text}
                        onChange={(e) => updateWeeklyGoalText(goal.id, e.target.value)}
                        className={`w-full bg-transparent border-b border-transparent focus:border-earth focus:outline-none text-xs ${
                          goal.completed ? 'text-regolith/50 line-through' : 'text-white font-medium'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-bold uppercase inline-block ${
                          goal.completed ? 'text-emerald-400' : 'text-earth'
                        }`}
                      >
                        {goal.completed ? '✓ Achieved' : 'Pending Milestone'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 11: ADHERENCE ANALYTICS (F093) --- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Panel
            title="Exercise Countermeasures vs Autonomic Tone (Dual-Axis Analytics)"
            subtitle="Evaluating correlation between daily workout minutes and parasympathetic HRV preservation"
          >
            <div className="h-[220px] sm:h-72 font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adherenceAnalyticsData} margin={{top: 10, right: 30, left: 10, bottom: 0}}>
                  <XAxis dataKey="day" stroke="#8b909b" fontSize={10} />
                  <YAxis
                    yAxisId="minutesAxis"
                    domain={[0, 80]}
                    stroke="#e2704a"
                    fontSize={10}
                    unit=" min"
                  />
                  <YAxis
                    yAxisId="hrvAxis"
                    orientation="right"
                    domain={[30, 90]}
                    stroke="#6fb6ff"
                    fontSize={10}
                    unit=" ms"
                  />
                  <Tooltip
                    content={({active, payload}) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded bg-void-2 border border-white/20 p-2.5 font-mono text-xs shadow-xl space-y-1">
                            <p className="text-white font-bold">{payload[0].payload.day}</p>
                            <p className="text-mars">Workout: {payload[0].value} minutes</p>
                            <p className="text-earth">Mean HRV: {payload[1].value} ms</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="minutesAxis"
                    type="monotone"
                    dataKey="minutes"
                    stroke="#e2704a"
                    strokeWidth={2.5}
                    name="Countermeasure Exertion (minutes)"
                    dot={{r: 4}}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="hrvAxis"
                    type="monotone"
                    dataKey="hrv"
                    stroke="#6fb6ff"
                    strokeWidth={2.5}
                    name="Mean Resting HRV (ms)"
                    dot={{r: 4}}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="rounded-xl bg-void-2 p-5 border border-white/10 space-y-2">
              <span className="font-bold text-white uppercase block">Cardiovascular Preservation Model</span>
              <p className="text-regolith/80 leading-relaxed">
                Sustaining &gt;35 min/day resistive/aerobic countermeasure directly correlates with preserving parasympathetic vagal tone (HRV &gt;55 ms). Days with missed workouts show an immediate next-day autonomic suppression of 10–14%.
              </p>
            </div>
            <div className="rounded-xl bg-void-2 p-5 border border-white/10 space-y-2">
              <span className="font-bold text-white uppercase block">Long-Duration Mars Transit Projection</span>
              <p className="text-regolith/80 leading-relaxed">
                Countermeasure fidelity through Sol 142 is projecting 94% retention of pre-flight aerobic capacity (VO2 max) and negligible trabecular bone loss in calcaneus and lumbar sites.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}