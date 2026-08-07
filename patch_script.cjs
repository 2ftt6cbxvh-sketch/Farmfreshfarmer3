const fs = require('fs');
const path = require('path');
const dir = '/Users/ganeshvarma/Desktop/FarmFreshFarmer';

// 1. package.json
let pkgPath = path.join(dir, 'package.json');
fs.writeFileSync(pkgPath, fs.readFileSync(pkgPath, 'utf8').replace(/"version": "1\.3\.7"/g, '"version": "1.3.8"'));

// 2. Footer.tsx
let footerPath = path.join(dir, 'client/src/components/Footer.tsx');
fs.writeFileSync(footerPath, fs.readFileSync(footerPath, 'utf8').replace(/v1\.3\.7/g, 'v1.3.8'));

// 3. register-routes.ts
let routesPath = path.join(dir, 'server/register-routes.ts');
fs.writeFileSync(routesPath, fs.readFileSync(routesPath, 'utf8').replace(/version: "1\.3\.7"/g, 'version: "1.3.8"'));

// 5. basket.tsx
let basketPath = path.join(dir, 'mobile-app/app/(tabs)/basket.tsx');
let basket = fs.readFileSync(basketPath, 'utf8');
if (!basket.includes('useThemeStore')) {
  basket = basket.replace(
    "import { useDelivery } from '../../hooks/useDelivery';",
    "import { useDelivery } from '../../hooks/useDelivery';\nimport { useThemeStore } from '../../lib/theme';"
  );
  basket = basket.replace(
    "export default function BasketScreen() {",
    "export default function BasketScreen() {\n  const { theme } = useThemeStore();\n  const isDark = theme === 'dark';"
  );
  basket = basket.replace(/backgroundColor: '#f8fafc'/g, "backgroundColor: isDark ? '#000000' : '#f8fafc'");
  basket = basket.replace(/backgroundColor: '#ffffff'/g, "backgroundColor: isDark ? '#0c121e' : '#ffffff'");
  basket = basket.replace(/color: COLORS\.text/g, "color: isDark ? '#f8fafc' : COLORS.text");
  basket = basket.replace(/borderColor: '#e2e8f0'/g, "borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#e2e8f0'");
  basket = basket.replace(/color: COLORS\.textMuted/g, "color: isDark ? '#94a3b8' : COLORS.textMuted");
  fs.writeFileSync(basketPath, basket);
}

// 6. orders.tsx
let ordersPath = path.join(dir, 'mobile-app/app/(tabs)/orders.tsx');
let orders = fs.readFileSync(ordersPath, 'utf8');
if (!orders.includes('useThemeStore')) {
  orders = orders.replace(
    "import type { Order } from '../../lib/types';",
    "import type { Order } from '../../lib/types';\nimport { useThemeStore } from '../../lib/theme';"
  );
  orders = orders.replace(
    "function OrderCard({ order }: { order: Order }) {",
    "function OrderCard({ order }: { order: Order }) {\n  const { theme } = useThemeStore();\n  const isDark = theme === 'dark';"
  );
  orders = orders.replace(
    "export default function OrdersScreen() {",
    "export default function OrdersScreen() {\n  const { theme } = useThemeStore();\n  const isDark = theme === 'dark';"
  );
  orders = orders.replace(/backgroundColor: '#f8fafc'/g, "backgroundColor: isDark ? '#000000' : '#f8fafc'");
  orders = orders.replace(/backgroundColor: '#ffffff'/g, "backgroundColor: isDark ? '#0c121e' : '#ffffff'");
  orders = orders.replace(/color: COLORS\.text/g, "color: isDark ? '#f8fafc' : COLORS.text");
  orders = orders.replace(/color: COLORS\.textMuted/g, "color: isDark ? '#94a3b8' : COLORS.textMuted");
  fs.writeFileSync(ordersPath, orders);
}

// 7. account.tsx
let accountPath = path.join(dir, 'mobile-app/app/(tabs)/account.tsx');
let account = fs.readFileSync(accountPath, 'utf8');
if (!account.includes('useThemeStore')) {
  account = account.replace(
    "import { COLORS, BRAND } from '../../constants/config';",
    "import { COLORS, BRAND } from '../../constants/config';\nimport { useThemeStore } from '../../lib/theme';"
  );
  account = account.replace(
    "export default function AccountScreen() {",
    "export default function AccountScreen() {\n  const { theme } = useThemeStore();\n  const isDark = theme === 'dark';"
  );
  account = account.replace(/backgroundColor: '#f8fafc'/g, "backgroundColor: isDark ? '#000000' : '#f8fafc'");
  account = account.replace(/backgroundColor: '#ffffff'/g, "backgroundColor: isDark ? '#0c121e' : '#ffffff'");
  account = account.replace(/color: COLORS\.text/g, "color: isDark ? '#f8fafc' : COLORS.text");
  account = account.replace(/color: COLORS\.textMuted/g, "color: isDark ? '#94a3b8' : COLORS.textMuted");
  fs.writeFileSync(accountPath, account);
}
