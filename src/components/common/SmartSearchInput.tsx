import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Department } from '../../types';
import {
    departmentMatchesSearch,
    getBudgetOwnerEffective,
    getDeptDisplay,
    getDeptLocationDisplay,
} from '../../utils/helpers';

interface SmartSearchInputProps {
    id?: string;
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    departments?: Department[];
    recentDepts?: string[];
    onRecentClick?: (dept: string) => void;
    themeColor: string;
}

const SmartSearchInput = ({ id, value, onChange, placeholder, departments, recentDepts, onRecentClick, themeColor }: SmartSearchInputProps) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const colorClasses = themeColor.includes('emerald')
        ? {
            text: 'text-emerald-700 dark:text-emerald-400',
            border: 'border-emerald-300 dark:border-emerald-400/20',
            focus: 'focus:ring-emerald-500/20'
          }
        : {
            text: 'text-purple-700 dark:text-purple-400',
            border: 'border-purple-300 dark:border-purple-400/20',
            focus: 'focus:ring-purple-500/20'
          };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);

    const filteredDepts = useMemo(() => {
        if (!departments) return [];
        if (!value) return departments.slice(0, 50);
        return departments.filter(d => departmentMatchesSearch(d, value)).slice(0, 50);
    }, [departments, value]);

    useEffect(() => {
        setActiveIndex(-1);
    }, [filteredDepts, showSuggestions]);

    return (
        <div className="relative" ref={wrapperRef}>
            {recentDepts && recentDepts.length > 0 && onRecentClick && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                    {recentDepts.map(dept => (
                        <button
                            key={dept}
                            onClick={() => onRecentClick(dept)}
                            type="button"
                            className={`bg-white/80 dark:bg-slate-900/60 border ${colorClasses.border} ${colorClasses.text} text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap hover:opacity-80 flex items-center gap-1 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none`}
                        >
                            <ArrowLeft size={10} className="rotate-180" /> {dept}
                        </button>
                    ))}
                </div>
            )}
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    className={`w-full px-4 py-3.5 border rounded-2xl bg-white dark:bg-slate-900/60 text-slate-800 dark:text-white border-slate-200 dark:border-white/10 focus:ring-2 ${colorClasses.focus} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none outline-none transition-all`}
                    placeholder={placeholder}
                    value={value}
                    onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onClick={() => setShowSuggestions(true)}
                    onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setShowSuggestions(true);
                            setActiveIndex(prev => Math.min(filteredDepts.length - 1, prev + 1));
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveIndex(prev => Math.max(0, prev - 1));
                        } else if (e.key === 'Enter') {
                            if (showSuggestions && activeIndex >= 0 && activeIndex < filteredDepts.length) {
                                e.preventDefault();
                                onChange(getDeptDisplay(filteredDepts[activeIndex]));
                                setShowSuggestions(false);
                            }
                        } else if (e.key === 'Escape') {
                            setShowSuggestions(false);
                        }
                    }}
                />
                {value && (
                    <button
                        onClick={() => { onChange(''); setShowSuggestions(true); }}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-full p-0.5"
                        aria-label="ล้างข้อความ"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
            {showSuggestions && filteredDepts.length > 0 && (
                <ul className="absolute z-50 w-full bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl mt-1.5 max-h-60 overflow-y-auto custom-scrollbar backdrop-blur-md" role="listbox">
                    {filteredDepts.map((d, idx) => {
                        const location = getDeptLocationDisplay(d);
                        const budgetOwner = getBudgetOwnerEffective(d);
                        const showBudgetOwner = budgetOwner !== d.DeptName;

                        return (
                            <li
                                key={d.DeptID}
                                tabIndex={-1}
                                role="option"
                                aria-selected={value === getDeptDisplay(d) || activeIndex === idx}
                                className={`px-4 py-3 cursor-pointer text-sm border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors focus-visible:outline-none ${activeIndex === idx ? 'bg-slate-100 dark:bg-slate-900/80 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'}`}
                                onClick={() => { onChange(getDeptDisplay(d)); setShowSuggestions(false); }}
                            >
                                <div className="font-bold text-slate-800 dark:text-slate-200">{d.DeptName}</div>
                                {location && <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">{location}</div>}
                                {showBudgetOwner && <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">ต้นสังกัดงบประมาณ: {budgetOwner}</div>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default SmartSearchInput;
