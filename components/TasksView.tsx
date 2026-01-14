
import React, { useState, useEffect } from 'react';
import { CulturalTask } from '../types';
import { mockApi } from '../services/mockApi';
import { BookOpen, Music, CheckCircle, ChevronRight, Award, Loader2, Sparkles, Languages } from 'lucide-react';

const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<CulturalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await mockApi.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch tasks failed:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleComplete = async (id: number) => {
    if (completingId !== null) return;
    setCompletingId(id);
    try {
      const res = await mockApi.completeTask(String(id));
      if (res.success) {
        await fetchTasks();
      }
    } catch (err) {
      console.error("Complete task UI error:", err);
    } finally {
      setCompletingId(null);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'quiz': return <Languages className="text-blue-400" size={20} />;
      case 'music': return <Music className="text-purple-400" size={20} />;
      case 'story': return <BookOpen className="text-orange-400" size={20} />;
      default: return <Award className="text-green-400" size={20} />;
    }
  };

  return (
    <div className="px-6 py-4 pb-20">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black mb-1">Heritage Quests</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Protect the Balochi Culture</p>
        </div>
        <div className="bg-orange-500/10 p-2.5 rounded-2xl border border-orange-500/20">
           <Sparkles className="text-orange-500" size={20} />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [1,2,3].map(i => (
            <div key={i} className="h-28 w-full glass animate-pulse rounded-[2rem]"></div>
          ))
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 glass rounded-[2rem]">
            <Award className="mx-auto text-slate-700 mb-4" size={48} />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Quests Available</p>
          </div>
        ) : (
          tasks.map(task => {
            if (!task) return null;
            return (
              <div 
                key={task.id} 
                onClick={() => !task.completed && handleComplete(task.id)}
                className={`p-5 rounded-[2.2rem] glass transition-all active:scale-95 cursor-pointer flex items-center justify-between group ${
                  task.completed ? 'opacity-40 grayscale-[0.5] pointer-events-none' : 'hover:border-orange-500/30'
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-white/5 ${
                    task.type === 'quiz' ? 'bg-blue-500/10' : 
                    task.type === 'music' ? 'bg-purple-500/10' : 'bg-orange-500/10'
                  }`}>
                    {completingId === task.id ? <Loader2 className="animate-spin text-orange-500" size={22} /> : getIcon(task.type || '')}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[15px] mb-1.5">{task.title || 'Tribal Quest'}</h3>
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/10">
                         <span className="text-[10px] font-black text-orange-400">+{task.bp_reward || 0} BP</span>
                      </div>
                      <div className="bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/10">
                         <span className="text-[10px] font-black text-purple-300">+{task.cultural_bp_reward || 0} CBP</span>
                      </div>
                    </div>
                  </div>
                </div>

                {task.completed ? (
                  <div className="bg-green-500/20 p-2.5 rounded-2xl">
                     <CheckCircle className="text-green-400" size={22} />
                  </div>
                ) : (
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 group-hover:bg-orange-500/20 group-hover:border-orange-500/30 transition-colors">
                    <ChevronRight size={18} className="text-slate-400 group-hover:text-orange-400" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-10 glass p-7 rounded-[2.5rem] relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl -mr-10 -mt-10"></div>
         <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
               <Award className="text-orange-500" size={18} />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest text-white">Multiplier Bonus</h4>
         </div>
         <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
            Balochi wisdom is your greatest strength. For every <span className="text-purple-400">1,000 CBP</span> collected, your tap production efficiency grows by <span className="text-orange-400">10%</span> permanently.
         </p>
      </div>
    </div>
  );
};

export default TasksView;
