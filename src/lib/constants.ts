import React from 'react';
import { Truck, Mail, Package, FileText, Globe } from 'lucide-react';

export const FUND_SOURCES = ["งบประมาณมหาวิทยาลัย", "งบประมาณวิสาหกิจ", "งบประมาณโครงการ"];
export const RUN_SAVING_PER_UNIT = 45;

export const THEMES: Record<string, any> = {
  run: { 
    name: 'งานบริการรับ-ส่งเอกสารภายใน', 
    bg: 'bg-blue-600', 
    text: 'text-blue-600', 
    border: 'border-blue-600', 
    light: 'bg-blue-50', 
    hover: 'hover:bg-blue-700', 
    icon: React.createElement(Truck, { size: 20 }) 
  },
  sort: { 
    name: 'งานบริการคัดแยก-นำจ่ายไปรษณีย์ภัณฑ์', 
    bg: 'bg-orange-500', 
    text: 'text-orange-500', 
    border: 'border-orange-500', 
    light: 'bg-orange-50', 
    hover: 'hover:bg-orange-600', 
    icon: React.createElement(Mail, { size: 20 }) 
  },
  ext: { 
    name: 'งานบริการนำส่งไปรษณีย์ภัณฑ์ภายนอก', 
    bg: 'bg-green-600', 
    text: 'text-green-600', 
    border: 'border-green-600', 
    light: 'bg-green-50', 
    hover: 'hover:bg-green-700', 
    icon: React.createElement(Package, { size: 20 }) 
  },
  report: { 
    name: 'รายงานผลการดำเนินงาน', 
    bg: 'bg-[#6A2C70]', 
    text: 'text-[#6A2C70]', 
    border: 'border-[#6A2C70]', 
    light: 'bg-purple-50', 
    hover: 'hover:bg-purple-800', 
    icon: React.createElement(FileText, { size: 20 }) 
  },
  default: { 
    name: 'ทั่วไป', 
    bg: 'bg-[#6A2C70]', 
    text: 'text-[#6A2C70]', 
    border: 'border-[#6A2C70]', 
    light: 'bg-purple-50', 
    hover: 'hover:bg-purple-800', 
    icon: React.createElement(Globe, { size: 20 }) 
  }
};
