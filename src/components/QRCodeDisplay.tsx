import { QRCodeSVG } from 'qrcode.react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

export function QRCodeDisplay() {
  const { language } = useLanguage();
  const siteUrl = 'https://simplycook.lovable.app';

  return (
    <Card className="inline-flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-lg">
      <QRCodeSVG
        value={siteUrl}
        size={180}
        bgColor="#ffffff"
        fgColor="#000000"
        level="H"
        includeMargin={false}
      />
      <p className="text-sm text-muted-foreground font-medium">
        {language === 'zh' ? '扫码在手机上打开' : 'Scan to open on mobile'}
      </p>
    </Card>
  );
}
