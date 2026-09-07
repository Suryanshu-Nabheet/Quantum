/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { $, append, addDisposableListener } from '../../../../../base/browser/dom.js';
import { localize } from '../../../../../nls.js';
import { IOnboardingStep } from '../../common/onboardingTypes.js';
import { IWorkbenchThemeService } from '../../../../services/themes/common/workbenchThemeService.js';

interface IThemeOption {
	id: string;
	label: string;
	description: string;
	previewColor: string;
	accentColor: string;
	titleBar: string;
	activityBar: string;
	sideBar: string;
	sideBarBorder: string;
	statusBar: string;
	lineWidths: readonly number[];
}

const QUANTUM_THEMES: IThemeOption[] = [
	{
		id: 'Quantum Dark',
		label: localize('onboarding.theme.quantumDark', 'Quantum Dark'),
		description: localize(
			'onboarding.theme.quantumDark.desc',
			'Default dark — calm contrast for long sessions',
		),
		previewColor: '#0d0d0d',
		accentColor: '#88C0D0',
		titleBar: '#0a0a0a',
		activityBar: '#0a0a0a',
		sideBar: '#0a0a0a',
		sideBarBorder: '#161616',
		statusBar: '#0a0a0a',
		lineWidths: [72, 48, 86, 58],
	},
	{
		id: 'Quantum Light',
		label: localize('onboarding.theme.quantumLight', 'Quantum Light'),
		description: localize(
			'onboarding.theme.quantumLight.desc',
			'Clean light surfaces for daytime focus',
		),
		previewColor: '#FFFFFF',
		accentColor: '#0887A0',
		titleBar: '#ECECEC',
		activityBar: '#ECECEC',
		sideBar: '#F5F5F5',
		sideBarBorder: '#D4D4D4',
		statusBar: '#ECECEC',
		lineWidths: [68, 42, 80, 55],
	},
	{
		id: 'Quantum High Contrast',
		label: localize('onboarding.theme.quantumHc', 'High Contrast'),
		description: localize(
			'onboarding.theme.quantumHc.desc',
			'Maximum contrast for accessibility',
		),
		previewColor: '#0A0A0A',
		accentColor: '#88C0D0',
		titleBar: '#0A0A0A',
		activityBar: '#0A0A0A',
		sideBar: '#0A0A0A',
		sideBarBorder: '#ffffff1a',
		statusBar: '#0A0A0A',
		lineWidths: [70, 45, 88, 52],
	},
];

export class CustomThemeStep extends Disposable implements IOnboardingStep {
	readonly element: HTMLElement;
	readonly title = localize('onboarding.customTheme', 'Custom Theme');
	readonly canProceed = true;

	constructor(
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService,
	) {
		super();
		this.element = $('.onboarding-step.custom-theme-step');
		this.render();
	}

	private render() {
		const container = append(this.element, $('.theme-step-content'));

		const header = append(container, $('.theme-heading'));
		append(
			header,
			$('h2', undefined, localize('onboarding.theme.heading', 'Choose a theme')),
		);
		append(
			header,
			$(
				'p',
				undefined,
				localize(
					'onboarding.theme.subheading',
					'You can change this anytime in Settings.',
				),
			),
		);

		const grid = append(container, $('.theme-cards-grid'));
		grid.setAttribute('role', 'radiogroup');
		grid.setAttribute(
			'aria-label',
			localize('onboarding.theme.ariaLabel', 'Theme Selection'),
		);

		const themeCards: HTMLElement[] = [];
		QUANTUM_THEMES.forEach((theme) => {
			const card = append(grid, $('.theme-card'));
			themeCards.push(card);
			card.setAttribute('tabindex', '0');
			card.setAttribute('role', 'radio');
			card.setAttribute('aria-checked', 'false');
			card.setAttribute('aria-label', theme.label);

			const previewContainer = append(card, $('.theme-card-preview-area'));

			const fakeIde = append(previewContainer, $('.theme-fake-ide'));
			fakeIde.style.borderColor = theme.sideBarBorder;

			const fakeTitleBar = append(fakeIde, $('.theme-fake-titlebar'));
			fakeTitleBar.style.backgroundColor = theme.titleBar;
			const dots = append(fakeTitleBar, $('.theme-fake-dots'));
			append(dots, $('.theme-dot.theme-dot-red'));
			append(dots, $('.theme-dot.theme-dot-yellow'));
			append(dots, $('.theme-dot.theme-dot-green'));

			const fakeMain = append(fakeIde, $('.theme-fake-main'));

			const fakeActivityBar = append(fakeMain, $('.theme-fake-activitybar'));
			fakeActivityBar.style.backgroundColor = theme.activityBar;
			fakeActivityBar.style.borderRight = `1px solid ${theme.sideBarBorder}`;

			const icon1 = append(fakeActivityBar, $('.theme-fake-icon'));
			icon1.style.backgroundColor = theme.accentColor;
			const icon2 = append(fakeActivityBar, $('.theme-fake-icon'));
			icon2.style.backgroundColor = `color-mix(in srgb, ${theme.accentColor} 28%, transparent)`;

			const fakeSidebar = append(fakeMain, $('.theme-fake-sidebar'));
			fakeSidebar.style.backgroundColor = theme.sideBar;
			fakeSidebar.style.borderRight = `1px solid ${theme.sideBarBorder}`;

			const sidebarWidths = ['70%', '48%', '82%', '56%'];
			for (let j = 0; j < 4; j++) {
				const item = append(fakeSidebar, $('.theme-fake-sidebar-item'));
				item.style.backgroundColor = `color-mix(in srgb, ${theme.accentColor} 12%, transparent)`;
				item.style.width = sidebarWidths[j]!;
			}

			const fakeEditor = append(fakeMain, $('.theme-fake-editor'));
			fakeEditor.style.backgroundColor = theme.previewColor;

			const fakeTabs = append(fakeEditor, $('.theme-fake-tabs'));
			fakeTabs.style.backgroundColor = theme.titleBar;

			const fakeTab1 = append(fakeTabs, $('.theme-fake-tab.active'));
			fakeTab1.style.backgroundColor = theme.previewColor;
			fakeTab1.style.borderTop = `2px solid ${theme.accentColor}`;

			append(fakeTabs, $('.theme-fake-tab'));

			const fakeEditorContent = append(fakeEditor, $('.theme-fake-editor-content'));
			for (let i = 0; i < theme.lineWidths.length; i++) {
				const lineWrap = append(fakeEditorContent, $('.theme-fake-line-wrap'));
				const gutter = append(lineWrap, $('.theme-fake-gutter'));
				gutter.textContent = String(i + 1);

				const line = append(lineWrap, $('.theme-fake-line'));
				line.style.width = `${theme.lineWidths[i]}%`;
				line.style.backgroundColor =
					i === 1
						? theme.accentColor
						: `color-mix(in srgb, ${theme.accentColor} 35%, transparent)`;
			}

			const fakeStatusBar = append(fakeIde, $('.theme-fake-statusbar'));
			fakeStatusBar.style.backgroundColor = theme.statusBar;

			const info = append(card, $('.theme-card-info'));
			append(info, $('.theme-card-title', undefined, theme.label));
			append(info, $('.theme-card-desc', undefined, theme.description));

			const activeCheck = append(card, $('.theme-active-check'));
			activeCheck.setAttribute('aria-hidden', 'true');
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('width', '14');
			svg.setAttribute('height', '14');
			svg.setAttribute('viewBox', '0 0 16 16');
			svg.setAttribute('fill', 'currentColor');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute(
				'd',
				'M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z',
			);
			svg.appendChild(path);
			activeCheck.appendChild(svg);

			const selectTheme = async () => {
				for (const c of themeCards) {
					c.classList.remove('active');
					c.setAttribute('aria-checked', 'false');
				}
				card.classList.add('active');
				card.setAttribute('aria-checked', 'true');

				const themes = await this.themeService.getColorThemes();
				const target = themes.find(
					(t) =>
						t.id === theme.id ||
						t.label === theme.id ||
						t.settingsId === theme.id,
				);

				if (target) {
					await this.themeService.setColorTheme(target.id, 'auto');
				} else {
					await this.themeService.setColorTheme(theme.id, 'auto');
				}
			};

			const updateActiveState = () => {
				const currentTheme = this.themeService.getColorTheme();
				const isActive =
					currentTheme.id === theme.id ||
					currentTheme.label === theme.id ||
					currentTheme.label === theme.label ||
					currentTheme.settingsId === theme.id;
				card.classList.toggle('active', isActive);
				card.setAttribute('aria-checked', isActive ? 'true' : 'false');
			};

			updateActiveState();

			this._register(
				this.themeService.onDidColorThemeChange(() => {
					updateActiveState();
				}),
			);

			this._register(addDisposableListener(card, 'click', () => {
				void selectTheme();
			}));
			this._register(
				addDisposableListener(card, 'keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						void selectTheme();
					}
				}),
			);
		});
	}

	onEnter(): void { }
	onExit(): void { }
}
