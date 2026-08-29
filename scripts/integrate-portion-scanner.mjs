import fs from 'node:fs';

const file = 'App.tsx';
let source = fs.readFileSync(file, 'utf8');

const importLine = "import { PortionScannerEntry } from './src/PortionScannerEntry';";

if (!source.includes(importLine)) {
  const importAnchor = "} from 'react-native-safe-area-context';";
  if (!source.includes(importAnchor)) {
    throw new Error('Safe-area import anchor was not found in App.tsx.');
  }
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const scannerUsage = '<PortionScannerEntry foodName={selectedFood.name} />';

if (!source.includes(scannerUsage)) {
  const buttonAnchor = '              <PrimaryButton label="Add to meal" onPress={addSelected} />';
  if (!source.includes(buttonAnchor)) {
    throw new Error('Add-to-meal button anchor was not found in App.tsx.');
  }
  source = source.replace(
    buttonAnchor,
    `              ${scannerUsage}\n\n${buttonAnchor}`
  );
}

fs.writeFileSync(file, source);
console.log('Portion scanner entry integrated into Add Meal.');
