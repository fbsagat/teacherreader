import React, { useMemo, useState } from 'react';
import { StudyStats } from '../types/shadowreader';
import { getBrazilianPhoneticTip } from '../utils/shadowing';
import { localDayKey } from '../utils/localTime';

export type StatsTabId = 'goals' | 'achievements' | 'lexicon';

interface StatsModalProps {
  isOpen: boolean;
  stats: StudyStats;
  dailyGoal: number;
  practiceDaysGoal?: number;
  onUpdateDailyGoal: (goal: number) => void;
  onUpdatePracticeDaysGoal?: (days: number) => void;
  onSpeakWord: (word: string) => void;
  onOpenDict: (word: string) => void;
  onStartPractice?: () => void;
  onClose: () => void;
}

const DAILY_SENTENCE_GOALS = [3, 5, 10, 15, 20, 30, 50];
const PRACTICE_DAYS_GOALS = [3, 5, 7, 14, 21, 30, 60];
const HISTORY_RANGES: Array<7 | 14 | 30> = [7, 14, 30];

interface FluencyRankInfo {
  level: number;
  title: string;
  nextTitle: string;
  currentXp: number;
  levelMinXp: number;
  nextLevelXp: number;
  progressPct: number;
}

function computeFluencyRank(
  stats: StudyStats,
  activeDaysCount: number,
  goalMetDaysCount: number
): FluencyRankInfo {
  const currentXp =
    stats.totalSentencesCompleted * 25 +
    stats.masteredWords.length * 10 +
    activeDaysCount * 45 +
    goalMetDaysCount * 60 +
    stats.bestStreak * 15;

  const tiers = [
    { level: 1, title: 'Explorador Fonético', minXp: 0 },
    { level: 2, title: 'Leitor Ritmado', minXp: 250 },
    { level: 3, title: 'Orador Confiante', minXp: 700 },
    { level: 4, title: 'Mestre do Shadowing', minXp: 1600 },
    { level: 5, title: 'Fluência Literária', minXp: 3200 },
    { level: 6, title: 'Lenda Bilíngue', minXp: 6000 }
  ];

  let idx = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (currentXp >= tiers[i].minXp) {
      idx = i;
    }
  }

  const currentTier = tiers[idx];
  const nextTier = tiers[idx + 1] || {
    level: currentTier.level + 1,
    title: 'Domínio Supremo',
    minXp: currentTier.minXp + 3000
  };

  const span = Math.max(1, nextTier.minXp - currentTier.minXp);
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round(((currentXp - currentTier.minXp) / span) * 100))
  );

  return {
    level: currentTier.level,
    title: currentTier.title,
    nextTitle: nextTier.title,
    currentXp,
    levelMinXp: currentTier.minXp,
    nextLevelXp: nextTier.minXp,
    progressPct
  };
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  stats,
  dailyGoal,
  practiceDaysGoal = 14,
  onUpdateDailyGoal,
  onUpdatePracticeDaysGoal,
  onSpeakWord,
  onOpenDict,
  onStartPractice,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<StatsTabId>('goals');
  const [historyRange, setHistoryRange] = useState<7 | 14 | 30>(14);
  const [lexiconView, setLexiconView] = useState<'tricky' | 'mastered'>('tricky');
  const [lexiconPage, setLexiconPage] = useState(0);

  const todayKey = localDayKey();
  const todayEntry = stats.dailyHistory[todayKey] || {
    dateKey: todayKey,
    sentencesPracticed: 0,
    totalScoreSum: 0,
    evaluationsCount: 0
  };

  // Build history for 7, 14, or 30 days
  const historyDays = useMemo(() => {
    const days: Array<{
      label: string;
      shortDate: string;
      key: string;
      count: number;
      avgScore: number;
      goalMet: boolean;
    }> = [];
    for (let i = historyRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDayKey(d);
      const entry = stats.dailyHistory[key];
      const count = entry?.sentencesPracticed || 0;
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const shortDate = d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
      days.push({
        label,
        shortDate,
        key,
        count,
        avgScore:
          entry && entry.evaluationsCount > 0
            ? Math.round(entry.totalScoreSum / entry.evaluationsCount)
            : 0,
        goalMet: count >= Math.max(1, dailyGoal)
      });
    }
    return days;
  }, [stats.dailyHistory, historyRange, dailyGoal]);

  // Calculate active days & consecutive day streak
  const { activeDaysCount, goalMetDaysCount, consecutiveDaysStreak, overallAccuracy } =
    useMemo(() => {
      let totalSum = 0;
      let totalEvals = 0;
      let activeDays = 0;
      let goalMetDays = 0;

      Object.values(stats.dailyHistory).forEach(d => {
        totalSum += d.totalScoreSum;
        totalEvals += d.evaluationsCount;
        if (d.sentencesPracticed > 0 || d.evaluationsCount > 0) {
          activeDays += 1;
        }
        if (d.sentencesPracticed >= Math.max(1, dailyGoal)) {
          goalMetDays += 1;
        }
      });

      // Consecutive days streak up to today or yesterday
      let dayStreak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = localDayKey(d);
        const entry = stats.dailyHistory[key];
        const practiced = Boolean(
          entry && (entry.sentencesPracticed > 0 || entry.evaluationsCount > 0)
        );
        if (practiced) {
          dayStreak += 1;
        } else if (i === 0) {
          // Today not practiced yet; check if yesterday keeps streak alive
          continue;
        } else {
          break;
        }
      }

      return {
        activeDaysCount: activeDays,
        goalMetDaysCount: goalMetDays,
        consecutiveDaysStreak: dayStreak,
        overallAccuracy: totalEvals > 0 ? Math.round(totalSum / totalEvals) : 0
      };
    }, [stats.dailyHistory, dailyGoal]);

  const rankInfo = useMemo(
    () => computeFluencyRank(stats, activeDaysCount, goalMetDaysCount),
    [stats, activeDaysCount, goalMetDaysCount]
  );

  const allTrickyWords = useMemo(() => {
    return Object.entries(stats.trickyWords).sort((a, b) => b[1] - a[1]);
  }, [stats.trickyWords]);

  const allMasteredWords = useMemo(() => {
    return [...stats.masteredWords].reverse();
  }, [stats.masteredWords]);

  if (!isOpen) return null;

  const dailyPct = Math.min(
    100,
    Math.round((todayEntry.sentencesPracticed / Math.max(1, dailyGoal)) * 100)
  );
  const remainingToday = Math.max(0, dailyGoal - todayEntry.sentencesPracticed);

  const daysGoalPct = Math.min(
    100,
    Math.round((activeDaysCount / Math.max(1, practiceDaysGoal)) * 100)
  );
  const remainingDaysGoal = Math.max(0, practiceDaysGoal - activeDaysCount);

  const maxBar = Math.max(dailyGoal, ...historyDays.map(d => d.count), 5);

  // Achievements / Milestones
  const achievements = [
    {
      id: 'first_step',
      title: 'Primeira Voz',
      desc: 'Concluir sua 1ª sentença falada em inglês',
      current: Math.min(1, stats.totalSentencesCompleted),
      target: 1,
      unlocked: stats.totalSentencesCompleted >= 1,
      rewardXp: '+25 XP'
    },
    {
      id: 'daily_champion',
      title: 'Meta do Dia Batida',
      desc: `Concluir ${dailyGoal} sentenças no mesmo dia`,
      current: Math.min(dailyGoal, todayEntry.sentencesPracticed),
      target: dailyGoal,
      unlocked: todayEntry.sentencesPracticed >= dailyGoal,
      rewardXp: '+60 XP'
    },
    {
      id: 'streak_master',
      title: 'Ritmo Implacável',
      desc: 'Atingir 5 frases seguidas sem erro de pronúncia',
      current: Math.min(5, stats.bestStreak),
      target: 5,
      unlocked: stats.bestStreak >= 5,
      rewardXp: '+75 XP'
    },
    {
      id: 'habit_builder',
      title: `Ciclo de ${practiceDaysGoal} Dias`,
      desc: `Praticar inglês em ${practiceDaysGoal} dias do seu plano`,
      current: Math.min(practiceDaysGoal, activeDaysCount),
      target: practiceDaysGoal,
      unlocked: activeDaysCount >= practiceDaysGoal,
      rewardXp: '+150 XP'
    },
    {
      id: 'lexicon_builder',
      title: 'Domínio Lexical',
      desc: 'Pronunciar 25 palavras diferentes com precisão',
      current: Math.min(25, stats.masteredWords.length),
      target: 25,
      unlocked: stats.masteredWords.length >= 25,
      rewardXp: '+100 XP'
    },
    {
      id: 'native_precision',
      title: 'Clareza Fonética',
      desc: 'Manter precisão média igual ou superior a 85%',
      current: stats.totalSentencesCompleted > 0 ? Math.min(85, overallAccuracy) : 0,
      target: 85,
      unlocked: stats.totalSentencesCompleted >= 3 && overallAccuracy >= 85,
      rewardXp: '+120 XP'
    }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  // Pagination for Lexicon tab (4 items per page so there is NEVER a vertical scrollbar)
  const LEXICON_PAGE_SIZE = 4;
  const activeLexiconTotal =
    lexiconView === 'tricky' ? allTrickyWords.length : allMasteredWords.length;
  const totalLexiconPages = Math.max(1, Math.ceil(activeLexiconTotal / LEXICON_PAGE_SIZE));
  const safeLexiconPage = Math.min(lexiconPage, totalLexiconPages - 1);
  const pageStart = safeLexiconPage * LEXICON_PAGE_SIZE;

  const visibleTrickySlice = allTrickyWords.slice(pageStart, pageStart + LEXICON_PAGE_SIZE);
  const visibleMasteredSlice = allMasteredWords.slice(
    pageStart,
    pageStart + LEXICON_PAGE_SIZE
  );

  // Motivating message for the footer
  const motivationalText =
    remainingToday > 0
      ? `Faltam ${remainingToday} ${remainingToday === 1 ? 'frase' : 'frases'} hoje para bater sua meta diária (${dailyPct}%)!`
      : remainingDaysGoal > 0
        ? `Meta de hoje concluída! Faltam ${remainingDaysGoal} ${remainingDaysGoal === 1 ? 'dia' : 'dias'} para completar seu ciclo de ${practiceDaysGoal} dias.`
        : `Meta diária e ciclo de ${practiceDaysGoal} dias concluídos! Continue subindo para o Nível ${rankInfo.level + 1}.`;

  return (
    <div
      id="modalStats"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="statsModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-[min(1040px,95vw)] h-[min(760px,92dvh)] p-4 sm:p-5 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Header + Rank Summary Strip */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-emerald-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 id="statsModalTitle" className="text-sm sm:text-base font-bold text-white truncate">
                Progresso, Metas & Domínio Lexical
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 tabular-nums">
              <span className="font-semibold text-brand-300">
                Nível {rankInfo.level} · {rankInfo.title}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-400">{rankInfo.currentXp} XP</span>
              <span aria-hidden="true">·</span>
              <span>
                Ofensiva: <strong className="text-amber-300">{consecutiveDaysStreak}d</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar estatísticas"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* 3 Compact Navigation Tabs (Concise non-overlapping labels on mobile) */}
        <div
          id="statsTabsNav"
          role="tablist"
          aria-label="Seções de Progresso"
          className="grid grid-cols-3 gap-1 sm:gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800/90 mt-3 shrink-0"
        >
          <button
            id="tabStatsGoals"
            type="button"
            role="tab"
            aria-selected={activeTab === 'goals'}
            onClick={() => setActiveTab('goals')}
            className={`min-h-[40px] sm:min-h-0 py-1.5 px-1.5 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap overflow-hidden ${
              activeTab === 'goals'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <span className="truncate">
              <span className="sm:hidden">Metas</span>
              <span className="hidden sm:inline">Metas & Dias</span>
            </span>
            <span
              className={`text-[10px] font-mono tabular-nums shrink-0 ${
                activeTab === 'goals' ? 'text-brand-100' : 'text-slate-400'
              }`}
            >
              {dailyPct}%
            </span>
          </button>

          <button
            id="tabStatsAchievements"
            type="button"
            role="tab"
            aria-selected={activeTab === 'achievements'}
            onClick={() => setActiveTab('achievements')}
            className={`min-h-[40px] sm:min-h-0 py-1.5 px-1.5 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap overflow-hidden ${
              activeTab === 'achievements'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <span className="truncate">
              <span className="sm:hidden">Conquistas</span>
              <span className="hidden sm:inline">Nível & Conquistas</span>
            </span>
            <span
              className={`text-[10px] font-mono tabular-nums shrink-0 ${
                activeTab === 'achievements' ? 'text-brand-100' : 'text-slate-400'
              }`}
            >
              {unlockedCount}/{achievements.length}
            </span>
          </button>

          <button
            id="tabStatsLexicon"
            type="button"
            role="tab"
            aria-selected={activeTab === 'lexicon'}
            onClick={() => setActiveTab('lexicon')}
            className={`min-h-[40px] sm:min-h-0 py-1.5 px-1.5 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap overflow-hidden ${
              activeTab === 'lexicon'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <span className="truncate">
              <span className="sm:hidden">Léxico</span>
              <span className="hidden sm:inline">Domínio Lexical</span>
            </span>
            <span
              className={`text-[10px] font-mono tabular-nums shrink-0 ${
                activeTab === 'lexicon' ? 'text-brand-100' : 'text-slate-400'
              }`}
            >
              {stats.masteredWords.length}
            </span>
          </button>
        </div>

        {/* Scrollable Content Wrapper for Mobile Screens */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-0.5">
        {/* TAB 1: METAS DIÁRIAS, META DE DIAS & HISTÓRICO */}
        {activeTab === 'goals' && (
          <div id="statsPanelGoals" className="space-y-2.5 text-xs">
            {/* Dual Goal Row: Sentences per Day + Practice Days Target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Card A: Daily Sentence Goal */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-white text-xs">Meta Diária de Frases</h4>
                    <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums">
                      {todayEntry.sentencesPracticed}/{dailyGoal} hoje ({dailyPct}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Escolha quantas sentenças deseja dominar por dia:
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {DAILY_SENTENCE_GOALS.map(g => (
                    <button
                      key={g}
                      id={`btnDailyGoal_${g}`}
                      type="button"
                      onClick={() => onUpdateDailyGoal(g)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer tabular-nums transition whitespace-nowrap ${
                        dailyGoal === g
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {g}/dia
                    </button>
                  ))}
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-brand-500 h-full transition-all duration-300"
                    style={{ width: `${dailyPct}%` }}
                  />
                </div>
              </div>

              {/* Card B: Multi-Day Consistency Goal (Mais Dias de Prática) */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-white text-xs">Meta de Dias de Prática</h4>
                    <span className="text-[11px] font-mono font-bold text-amber-300 tabular-nums">
                      {activeDaysCount}/{practiceDaysGoal} dias ({daysGoalPct}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Defina seu ciclo de consistência (dias praticados):
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {PRACTICE_DAYS_GOALS.map(dGoal => (
                    <button
                      key={dGoal}
                      id={`btnPracticeDaysGoal_${dGoal}`}
                      type="button"
                      onClick={() => {
                        onUpdatePracticeDaysGoal?.(dGoal);
                        if (dGoal <= 7) setHistoryRange(7);
                        else if (dGoal <= 14) setHistoryRange(14);
                        else setHistoryRange(30);
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer tabular-nums transition whitespace-nowrap ${
                        practiceDaysGoal === dGoal
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {dGoal} dias
                    </button>
                  ))}
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${daysGoalPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 4 Compact KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Frases Faladas</span>
                <span className="text-sm sm:text-base font-extrabold text-white mt-0.5 block">
                  {stats.totalSentencesCompleted}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Precisão Média</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5 block">
                  {overallAccuracy > 0 ? `${overallAccuracy}%` : '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Vocabulário Ativo</span>
                <span className="text-sm sm:text-base font-extrabold text-brand-300 mt-0.5 block">
                  {stats.masteredWords.length} pal.
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Melhor Sequência</span>
                <span className="text-sm sm:text-base font-extrabold text-amber-400 mt-0.5 block">
                  {stats.bestStreak} seguidas
                </span>
              </div>
            </div>

            {/* Multi-Day Activity & Consistency Chart (7 / 14 / 30 days) */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-bold text-slate-200 text-xs">
                    Histórico de Prática ({historyRange} Dias)
                  </h4>
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    Dias com meta batida: <strong className="text-emerald-400">{goalMetDaysCount}</strong> · Dias ativos: <strong className="text-slate-200">{activeDaysCount}</strong>
                  </p>
                </div>

                {/* 7d / 14d / 30d Range Selector */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  {HISTORY_RANGES.map(range => (
                    <button
                      key={range}
                      id={`btnHistoryRange_${range}`}
                      type="button"
                      onClick={() => setHistoryRange(range)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer tabular-nums transition whitespace-nowrap ${
                        historyRange === range
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {range} dias
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="grid items-end h-20 pt-1 gap-1"
                style={{
                  gridTemplateColumns: `repeat(${historyDays.length}, minmax(0, 1fr))`
                }}
              >
                {historyDays.map((day, idx) => {
                  const heightPct = Math.max(10, Math.round((day.count / maxBar) * 100));
                  const isToday = day.key === todayKey;
                  const showLabel =
                    historyRange === 7 ||
                    historyRange === 14 ||
                    isToday ||
                    idx % 4 === 0;

                  return (
                    <div
                      key={day.key}
                      title={`${day.shortDate} (${day.label}): ${day.count} sentenças${day.avgScore ? ` · Média ${day.avgScore}%` : ''}`}
                      className="flex flex-col items-center gap-0.5 h-full justify-end min-w-0"
                    >
                      {historyRange <= 14 && (
                        <span className="text-[9px] font-mono text-slate-400 tabular-nums">
                          {day.count}
                        </span>
                      )}
                      <div className="w-full bg-slate-900 rounded-t h-12 flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t transition-all ${
                            day.goalMet
                              ? 'bg-emerald-500'
                              : day.count > 0
                                ? isToday
                                  ? 'bg-amber-400'
                                  : 'bg-brand-500'
                                : 'bg-slate-800/80'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span
                        className={`text-[9px] truncate max-w-full tabular-nums ${
                          isToday ? 'font-bold text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {showLabel ? (historyRange === 30 ? day.shortDate.slice(0, 2) : day.label) : '·'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NÍVEL DE FLUÊNCIA & CONQUISTAS */}
        {activeTab === 'achievements' && (
          <div id="statsPanelAchievements" className="space-y-2.5 text-xs">
            {/* Fluency Rank & XP Progression Banner */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-brand-300">
                    Patente Atual · Nível {rankInfo.level}
                  </span>
                  <h4 className="text-sm font-extrabold text-white">
                    {rankInfo.title}
                  </h4>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-xs font-mono font-bold text-emerald-400 block">
                    {rankInfo.currentXp} / {rankInfo.nextLevelXp} XP
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Próximo: {rankInfo.nextTitle}
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${rankInfo.progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                <span>+25 XP por frase concluída</span>
                <span>·</span>
                <span>+10 XP por palavra nova</span>
                <span>·</span>
                <span>+60 XP ao bater meta diária</span>
              </div>
            </div>

            {/* 2x3 Compact Grid of Unlockable Milestones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {achievements.map(ach => {
                const pct = Math.min(
                  100,
                  Math.round((ach.current / Math.max(1, ach.target)) * 100)
                );
                return (
                  <div
                    key={ach.id}
                    className={`p-2.5 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                      ach.unlocked
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-slate-950/50 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold text-xs truncate ${
                              ach.unlocked ? 'text-emerald-300' : 'text-slate-200'
                            }`}
                          >
                            {ach.unlocked ? '✓ ' : ''}
                            {ach.title}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {ach.desc}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-semibold shrink-0 tabular-nums ${
                          ach.unlocked ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {ach.rewardXp}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            ach.unlocked ? 'bg-emerald-400' : 'bg-brand-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                        {ach.current}/{ach.target}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: DOMÍNIO LEXICAL (REFORÇO FONÉTICO & PALAVRAS DOMINADAS) */}
        {activeTab === 'lexicon' && (
          <div id="statsPanelLexicon" className="space-y-2.5 text-xs">
            {/* Sub-navigation between Tricky Words and Mastered Words + Pagination */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  id="btnLexiconTricky"
                  type="button"
                  onClick={() => {
                    setLexiconView('tricky');
                    setLexiconPage(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                    lexiconView === 'tricky'
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Para Reforçar ({allTrickyWords.length})
                </button>
                <button
                  id="btnLexiconMastered"
                  type="button"
                  onClick={() => {
                    setLexiconView('mastered');
                    setLexiconPage(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                    lexiconView === 'mastered'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Palavras Dominadas ({allMasteredWords.length})
                </button>
              </div>

              {totalLexiconPages > 1 && (
                <div className="flex items-center gap-1.5 tabular-nums">
                  <button
                    type="button"
                    disabled={safeLexiconPage === 0}
                    onClick={() => setLexiconPage(p => Math.max(0, p - 1))}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-[10px] font-semibold cursor-pointer"
                  >
                    ◀ Ant.
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">
                    Pág. {safeLexiconPage + 1}/{totalLexiconPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeLexiconPage + 1 >= totalLexiconPages}
                    onClick={() =>
                      setLexiconPage(p => Math.min(totalLexiconPages - 1, p + 1))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-[10px] font-semibold cursor-pointer"
                  >
                    Próx. ▶
                  </button>
                </div>
              )}
            </div>

            {lexiconView === 'tricky' ? (
              visibleTrickySlice.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800 text-center space-y-1.5">
                  <p className="text-xs font-bold text-slate-300">
                    Nenhuma palavra pendente de reforço fonético!
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Continue praticando as frases em voz alta — qualquer palavra que precisar de ajuste aparecerá aqui com dicas de pronúncia.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {visibleTrickySlice.map(([word, count]) => {
                    const tip = getBrazilianPhoneticTip(word);
                    return (
                      <div
                        key={word}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{word}</span>
                            <span className="text-[10px] text-rose-400 tabular-nums">
                              · {count}x para revisar
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                            {tip
                              ? `${tip.category}: ${tip.tip}`
                              : 'Ouça em velocidade reduzida (0.8x) e repita prestando atenção na sílaba tônica.'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSpeakWord(word)}
                            className="px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            🔊 Ouvir 0.8x
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenDict(word);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Dicionário
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : visibleMasteredSlice.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800 text-center space-y-1.5">
                <p className="text-xs font-bold text-slate-300">
                  Suas palavras dominadas aparecerão aqui!
                </p>
                <p className="text-[11px] text-slate-400">
                  Pronuncie uma frase em inglês para começar a construir seu domínio lexical.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visibleMasteredSlice.map(word => (
                  <div
                    key={word}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-300 text-xs block truncate">
                        ✓ {word}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Pronúncia validada em treino
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSpeakWord(word)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-300 text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        🔊 Ouvir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenDict(word);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        </div>

        {/* Compact Motivational Footer with CTA */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
          <p className="text-[11px] text-slate-300 leading-snug sm:truncate">{motivationalText}</p>
          <button
            id="btnStatsContinuePractice"
            type="button"
            onClick={() => {
              onClose();
              onStartPractice?.();
            }}
            className="min-h-[42px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition cursor-pointer whitespace-nowrap shrink-0 text-center"
          >
            Continuar Praticando →
          </button>
        </div>
      </div>
    </div>
  );
};
