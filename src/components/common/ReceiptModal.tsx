import { Receipt, X, Copy } from 'lucide-react';

interface ReceiptModalProps {
    data: any;
    onClose: () => void;
    userName: string;
    onCopy: (text: string) => void;
}

const ReceiptModal = ({ data, onClose, userName, onCopy }: ReceiptModalProps) => {
    if (!data) return null;
    const isExt = data.type === 'นำส่งไปรษณีย์';
    const headerBg = isExt ? 'bg-emerald-500' : 'bg-orange-500';
    const headerText = isExt ? 'text-slate-950' : 'text-white';

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
                <div className={`${headerBg} p-4 ${headerText} text-center relative`}>
                    <h3 className="font-bold text-lg flex justify-center items-center gap-2"><Receipt /> ใบรับฝาก (Receipt)</h3>
                    <button onClick={onClose} className="absolute top-4 right-4 opacity-80 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg" aria-label="ปิดกล่องข้อความ"><X size={20} /></button>
                </div>
                <div className="p-6 bg-gray-50 text-gray-700 text-sm font-mono">
                    <div className="text-center mb-4 border-b pb-4 border-dashed border-gray-300">
                        <div className="font-bold text-lg text-gray-800">ส่วนอำนวยการสารบรรณ</div>
                        <div className="text-xs text-gray-700">{new Date().toLocaleString('th-TH')}</div>
                        <div className="text-xs text-gray-700">Ref: {data.txId}</div>
                    </div>
                    <div className="space-y-2 mb-4">
                        {data.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                                <span className="truncate w-2/3">{item.deptName}</span>
                                <span className="font-bold">{item.cost ? item.cost + '.-' : (item.itemCount || item.total) + ' ชิ้น'}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-dashed border-gray-300 pt-3 flex justify-between items-center text-base font-bold">
                        <span>รวมทั้งสิ้น</span>
                        <span>{data.totalCost > 0 ? data.totalCost + ' บาท' : data.totalCount + ' ชิ้น'}</span>
                    </div>
                    <div className="mt-6 text-center">
                        <div className="text-xs text-gray-500">__________________________</div>
                        <div className="text-xs text-gray-700 mt-1">ผู้รับฝาก ({userName})</div>
                    </div>
                </div>
                <div className="p-4 bg-white border-t flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-gray-700 font-bold focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg">ปิด</button>
                    <button onClick={() => {
                        const text = `ใบรับฝาก\nวันที่: ${new Date().toLocaleString('th-TH')}\nรายการ: ${data.items.length} รายการ\nยอดรวม: ${data.totalCost > 0 ? data.totalCost + ' บาท' : data.totalCount + ' ชิ้น'}`;
                        onCopy(text);
                    }} className={`flex-1 ${headerBg} ${isExt ? 'text-slate-950 font-extrabold' : 'text-white font-bold'} py-2 rounded-lg shadow flex justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none`}><Copy size={18} /> Copy</button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
