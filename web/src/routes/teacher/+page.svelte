<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import * as Message from '$lib/components/ai-elements/message';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import Expand from '@lucide/svelte/icons/expand';
	import Upload from '@lucide/svelte/icons/upload';
	import FileText from '@lucide/svelte/icons/file-text';
	import X from '@lucide/svelte/icons/x';

	let { data }: { data: PageData } = $props();
	let { attendance, students, feedback, struggles, spending, spent: totalSpent } = $derived(data.dashboard);
	$effect(() => {
		const timer = setInterval(invalidateAll, 5000);
		return () => clearInterval(timer);
	});
	let confirmEnd = $state(false);
	let confirmShutdown = $state(false);
	let shutDown = $state(false);
	let qrExpanded = $state(false);
	let lessonName = $state('');
	let spendingCap = $state<number | undefined>(untrack(() => data.dashboard.usage.spendingCap));
	const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' });
	let validCap = $derived(spendingCap !== undefined && Number.isFinite(spendingCap) && spendingCap >= 0);
	let spendingPercent = $derived(validCap ? (spendingCap! > 0 ? Math.min(totalSpent / spendingCap! * 100, 100) : 100) : 0);
	let spendingCeiling = $derived(Math.max(1, Math.ceil(totalSpent)));
	let spendingWidth = $state(380);
	let spendingHeight = $state(210);
	let attendanceWidth = $state(400);
	let attendanceHeight = $state(174);
	const spendingX = (i: number) => 44 + i * Math.max(0, spendingWidth - 68) / Math.max(1, spending.length - 1);
	const spendingY = (amount: number) => spendingHeight - 28 - amount / spendingCeiling * Math.max(0, spendingHeight - 40);
	const attendanceX = (i: number) => 32 + i * Math.max(0, attendanceWidth - 56) / Math.max(1, attendance.length - 1);
	let attendanceStep = $derived.by(() => {
		const rough = Math.max(1, ...attendance.map((item) => item.count)) / 4;
		const magnitude = 10 ** Math.floor(Math.log10(rough));
		return Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((step) => step >= rough)!);
	});
	let attendanceTicks = $derived(Array.from({ length: Math.ceil(Math.max(1, ...attendance.map((item) => item.count)) / attendanceStep) }, (_, i) => (i + 1) * attendanceStep));
	let attendanceCeiling = $derived(attendanceTicks.at(-1)!);
	const attendanceY = (count: number) => attendanceHeight - 28 - count / attendanceCeiling * Math.max(0, attendanceHeight - 40);
	let spendingPoints = $derived(spending.map((point, i) => `${spendingX(i)},${spendingY(point.amount)}`).join(' '));
	let resources = $state<{ title: string; url: string }[]>([]);
	let setupLoaded = $state(false);
	$effect(() => {
		if (!setupLoaded) {
			lessonName = data.config.lessonName;
			resources = data.config.resources.map((resource) => ({ ...resource }));
			setupLoaded = true;
		}
	});
	let pendingFiles = $state<File[]>([]);
	let uploadError = $state('');
	let fileInput: HTMLInputElement;
	let messageCount = $derived(students.reduce((total, student) => total + student.messages.length, 0));
	let averageRating = $derived(feedback.reduce((total, item) => total + item.rating, 0) / (feedback.length || 1));
	let latestAttendance = $derived(attendance.at(-1)?.count ?? 0);
	let attendanceChange = $derived(latestAttendance - (attendance.at(-2)?.count ?? latestAttendance));
	let attendancePoints = $derived(attendance.map((item, i) => `${attendanceX(i)},${attendanceY(item.count)}`).join(' '));
	let ratingCounts = $derived([1, 2, 3, 4, 5].map((rating) => feedback.filter((item) => item.rating === rating).length));
	const ratingColors = ['#d7b0a5', '#c8b68c', '#a9b9a0', '#8fa6ba', '#648d83'];
	let ratingSlices = $derived(ratingCounts.map((count, i) => {
		const start = ratingCounts.slice(0, i).reduce((sum, value) => sum + value, 0) / (feedback.length || 1) * Math.PI * 2 - Math.PI / 2;
		const angle = count / (feedback.length || 1) * Math.PI * 2;
		const end = start + angle;
		return { count, rating: i + 1, color: ratingColors[i], path: `M 80 80 L ${80 + 72 * Math.cos(start)} ${80 + 72 * Math.sin(start)} A 72 72 0 ${angle > Math.PI ? 1 : 0} 1 ${80 + 72 * Math.cos(end)} ${80 + 72 * Math.sin(end)} Z` };
	}));


	let splits = $state([78.0339, 45.6483, 56.2691, 45.066]);

	function horizontalWheel(node: HTMLElement) {
		function wheel(event: WheelEvent) {
			if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
			let target = event.target instanceof Element ? event.target : null;
			while (target && target !== node) {
				if (/auto|scroll/.test(getComputedStyle(target).overflowY)) {
					const remaining = target.scrollHeight - target.clientHeight - target.scrollTop;
					if (event.deltaY > 0 ? remaining > 1 : target.scrollTop > 1) return;
				}
				target = target.parentElement;
			}
			event.preventDefault();
			const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
			node.scrollLeft += event.deltaY * scale;
		}
		node.addEventListener('wheel', wheel, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', wheel) };
	}

	function resizeWidth(node: HTMLButtonElement) {
		const column = node.previousElementSibling as HTMLElement;
		let startX = 0;
		let startWidth = 0;
		function setWidth(width: number) {
			column.style.flexBasis = `${Math.max(280, Math.min(720, width))}px`;
		}
		function down(event: PointerEvent) {
			if (event.button !== 0) return;
			event.preventDefault();
			startX = event.clientX;
			startWidth = column.getBoundingClientRect().width;
			node.setPointerCapture(event.pointerId);
		}
		function move(event: PointerEvent) {
			if (node.hasPointerCapture(event.pointerId)) setWidth(startWidth + event.clientX - startX);
		}
		function up(event: PointerEvent) {
			if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
		}
		function key(event: KeyboardEvent) {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			setWidth(column.getBoundingClientRect().width + (event.key === 'ArrowRight' ? 16 : -16));
		}
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', up);
		node.addEventListener('keydown', key);
		return { destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('keydown', key);
		} };
	}

	function resizeCards(node: HTMLButtonElement, index: number) {
		let startY = 0;
		let startSplit = 0;
		let height = 0;
		function down(event: PointerEvent) {
			if (event.button !== 0) return;
			event.preventDefault();
			startY = event.clientY;
			startSplit = splits[index];
			height = node.parentElement!.clientHeight - 14;
			node.setPointerCapture(event.pointerId);
		}
		function move(event: PointerEvent) {
			if (!node.hasPointerCapture(event.pointerId)) return;
			splits[index] = Math.max(20, Math.min(80, startSplit + (event.clientY - startY) / height * 100));
		}
		function up(event: PointerEvent) {
			if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
		}
		function key(event: KeyboardEvent) {
			if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			event.preventDefault();
			splits[index] = Math.max(20, Math.min(80, splits[index] + (event.key === 'ArrowDown' ? 2 : -2)));
		}
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', up);
		node.addEventListener('keydown', key);
		return { destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('keydown', key);
		} };
	}

	function addFiles(files: FileList | null) {
		if (!files) return;
		uploadError = '';
		for (const file of Array.from(files)) {
			if (!/\.md$/i.test(file.name)) { uploadError = 'Only .md files are accepted.'; continue; }
			if (data.files.includes(file.name) || pendingFiles.some((item) => item.name === file.name)) { uploadError = `${file.name} is already listed.`; continue; }
			pendingFiles = [...pendingFiles, file];
		}
	}
</script>

{#snippet widthHandle(label: string)}
	<button type="button" class="column-resizer" use:resizeWidth aria-label={`Resize ${label} width`} title="Drag or use left/right arrow keys to resize"><span></span></button>
{/snippet}


<main class="teacher-dashboard">
	<h1 class="sr-only">Teacher dashboard</h1>
	<div class="lesson-actions">
		<form method="POST" action="?/signout" use:enhance><Button variant="secondary" type="submit" class="gap-2 rounded-full px-3 font-normal">Sign out</Button></form>
		<form method="POST" action="?/settings" enctype="multipart/form-data" use:enhance={({ formData }) => {
			formData.set('settings', JSON.stringify({ lessonName, resources, spendingCap }));
			for (const file of pendingFiles) formData.append('files', file);
			return async ({ result, update }) => { if (result.type === 'success') pendingFiles = []; await update(); };
		}}><Button variant="secondary" type="submit" class="gap-2 rounded-full px-3 font-normal" disabled={!validCap}>Save settings</Button></form>
		{#if data.lessonState === 'waiting'}
			<form method="POST" action="?/start" use:enhance><Button type="submit" class="gap-2 rounded-full px-3 font-normal">Start session</Button></form>
		{:else if data.lessonState === 'started'}
			<Button class="gap-2 rounded-full px-3 font-normal" onclick={() => confirmEnd = true}>End lesson</Button>
		{:else}
			<Button class="gap-2 rounded-full px-3 font-normal" onclick={() => confirmShutdown = true} disabled={shutDown}>{shutDown ? 'Shutting down…' : 'Shut down'}</Button>
		{/if}
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (The horizontal scroll region must be keyboard focusable.) -->
	<div use:horizontalWheel id="dashboard-rail" class="dashboard-rail" role="region" aria-label="Teacher dashboard cards" tabindex="0">
<div class="card-column" style:grid-template-rows={`${splits[0]}fr 14px ${100 - splits[0]}fr`}>
<section class="panel join-panel" aria-labelledby="join-title">
			<div class="flex items-center justify-between gap-3">
				<h2 id="join-title">Join the session</h2>
				<Button variant="secondary" class="gap-2 rounded-full px-3 font-normal" onclick={() => qrExpanded = true}><Expand class="size-3.5" />Expand</Button>
			</div>
			<div class="join-content">
				<img src={data.qr} alt="QR code for the student sign-in link" width="640" height="640" />
			</div>
			<a href={data.sessionUrl} class="shrink-0 break-all text-center text-sm text-muted-foreground hover:underline">{data.sessionUrl}</a>
		</section>
		<button type="button" class="card-resizer" use:resizeCards={0} aria-label="Resize join and settings cards" title="Drag or use up/down arrow keys to resize"><span></span></button>
		<section class="panel settings-panel" aria-labelledby="setup-title"><h2 id="setup-title">Lesson settings</h2><div class="panel-body mt-4"><div class="space-y-4">
				
				<div class="space-y-2"><label for="lesson-name" class="text-sm">Lesson name</label><input id="lesson-name" required bind:value={lessonName} class="field" /></div>
			</div></div></section>
		</div>
		{@render widthHandle("join and settings")}
		<div class="card-column" style:grid-template-rows={`${splits[1]}fr 14px ${100 - splits[1]}fr`}>
<section class="panel resources-panel" aria-labelledby="resources-title"><h2 id="resources-title">Lesson resources</h2><div class="panel-body mt-4"><div>
				<div class="space-y-3"><h3 class="text-sm">Resources</h3>
					{#each resources as resource, i}
						<div class="flex items-start gap-2"><div class="min-w-0 flex-1 space-y-2"><input aria-label={`Resource ${i + 1} title`} placeholder="Title" required bind:value={resource.title} class="field" /><input aria-label={`Resource ${i + 1} URL`} placeholder="https://…" type="url" required bind:value={resource.url} class="field" /></div><button type="button" class="remove-resource" aria-label={`Remove resource ${i + 1}`} onclick={() => resources = resources.filter((_, index) => index !== i)}><X class="size-4" /></button></div>
					{/each}
					<Button class="gap-2 rounded-full px-3 font-normal" onclick={() => resources = [...resources, { title: '', url: '' }]}>Add resource</Button>
				</div></div></div></section>
		<button type="button" class="card-resizer" use:resizeCards={1} aria-label="Resize resources and context files cards" title="Drag or use up/down arrow keys to resize"><span></span></button>
		<section class="panel files-panel" aria-labelledby="files-title"><h2 id="files-title">Context files</h2><div class="panel-body mt-4">			<div class="space-y-4">
				
				<button type="button" class="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring" onclick={() => fileInput.click()} ondragover={(event) => event.preventDefault()} ondrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer?.files ?? null); }}><Upload class="size-5" />Drop .md files here, or browse</button>
				<input bind:this={fileInput} type="file" multiple accept=".md" class="sr-only" tabindex="-1" aria-label="Choose Markdown context files" onchange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
				{#if uploadError}<p role="alert" class="text-sm text-destructive">{uploadError}</p>{/if}
				<ul class="divide-y">
					{#each data.files as file}<li class="flex items-center gap-2 py-3 text-sm"><FileText class="size-4 shrink-0 text-muted-foreground" /><span class="break-all">{file}</span><span class="ml-auto text-sm text-muted-foreground">Existing</span></li>{/each}
					{#each pendingFiles as file}<li class="flex items-center gap-2 py-2 text-sm"><FileText class="size-4 shrink-0 text-muted-foreground" /><span class="break-all">{file.name}</span><span class="ml-auto text-sm text-muted-foreground">Staged</span><Button size="icon-sm" class="rounded-full font-normal" aria-label={`Remove ${file.name}`} onclick={() => pendingFiles = pendingFiles.filter((item) => item !== file)}><X class="size-4" /></Button></li>{/each}
				</ul>
				{#if !data.files.length && !pendingFiles.length}<p class="text-sm text-muted-foreground">No context files yet.</p>{/if}
			</div></div></section>
		</div>
		{@render widthHandle("resources and files")}
		<div class="card-column" style:grid-template-rows={`${splits[2]}fr 14px ${100 - splits[2]}fr`}>
<section class="panel ratings-panel" aria-labelledby="ratings-title">
	<h2 id="ratings-title">Lesson ratings</h2>
	<div class="chart-stat"><strong>{averageRating.toFixed(1)}<small> / 5</small></strong><span>{feedback.length} responses</span></div>
	<div class="panel-body ratings-content">
		<svg class="ratings-pie" viewBox="0 0 160 160" role="img" aria-label={`Rating distribution: ${ratingCounts.map((count, i) => `${i + 1} stars: ${count}`).join(', ')}`}>
			{#each ratingSlices.filter((slice) => slice.count > 0) as slice}
				{#if slice.count === feedback.length}<circle cx="80" cy="80" r="72" fill={slice.color}><title>{slice.rating} stars: {slice.count} responses</title></circle>
				{:else}<path d={slice.path} fill={slice.color} stroke="white" stroke-width="2"><title>{slice.rating} stars: {slice.count} responses</title></path>{/if}
			{/each}
		</svg>
		<ul class="ratings-legend">
			{#each ratingSlices as slice}<li><span class="rating-swatch" style:background={slice.color}></span><span>{slice.rating} {slice.rating === 1 ? 'star' : 'stars'}</span><span class="text-muted-foreground">{slice.count} ({Math.round(slice.count / (feedback.length || 1) * 100)}%)</span></li>{/each}
		</ul>
	</div>
</section>
		<button type="button" class="card-resizer" use:resizeCards={2} aria-label="Resize ratings and attendance cards" title="Drag or use up/down arrow keys to resize"><span></span></button>
		<section class="panel trend-panel" aria-labelledby="attendance-title">
	<h2 id="attendance-title">Attendance trend</h2>
	<div class="chart-stat"><strong>{latestAttendance}</strong><span>{attendanceChange} from the previous session</span></div>
	<div class="chart-space attendance-space" bind:clientWidth={attendanceWidth} bind:clientHeight={attendanceHeight}><svg class="trend-chart" viewBox={`0 0 ${attendanceWidth} ${attendanceHeight}`} role="img" aria-label={`Attendance across five sessions: ${attendance.map((item) => item.count).join(', ')} students`}>
		<defs><linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#648d83" stop-opacity="0.22" /><stop offset="100%" stop-color="#648d83" stop-opacity="0" /></linearGradient></defs>
		{#each attendanceTicks as count}<line x1="32" x2={attendanceWidth - 24} y1={attendanceY(count)} y2={attendanceY(count)} stroke="#ededed" /><text x="8" y={attendanceY(count) + 4}>{count}</text>{/each}
		<polygon points={`32,${attendanceY(0)} ${attendancePoints} ${attendanceWidth - 24},${attendanceY(0)}`} fill="url(#attendance-fill)" />
		<polyline points={attendancePoints} fill="none" stroke="#527c72" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
		{#each attendance as item, i}<circle cx={attendanceX(i)} cy={attendanceY(item.count)} r="4" fill="white" stroke="#527c72" stroke-width="2"><title>{item.label}: {item.count} students</title></circle><text x={attendanceX(i)} y={attendanceHeight - 6} text-anchor="middle">{i === attendance.length - 1 ? 'Today' : `S${i + 1}`}</text>{/each}
	</svg></div>
</section>
		</div>
		{@render widthHandle("ratings and attendance")}
		<div class="card-column" style:grid-template-rows={`${splits[3]}fr 14px ${100 - splits[3]}fr`}>
<section class="panel snapshot-panel" aria-labelledby="snapshot-title">
	<h2 id="snapshot-title">Session snapshot</h2>
	<div class="panel-body metric-grid">
		<div><strong>{latestAttendance}</strong><span>Students this session</span></div>
		<div><strong>{(messageCount / (students.length || 1)).toFixed(1)}</strong><span>Average messages per chat</span></div>
		<div><strong>{messageCount}</strong><span>Chat messages</span></div>
		<div><strong>{data.dashboard.usage.tokensUsed.toLocaleString('en-GB')}</strong><span>Tokens used</span></div>
	</div>
</section>
		<button type="button" class="card-resizer" use:resizeCards={3} aria-label="Resize snapshot and feedback cards" title="Drag or use up/down arrow keys to resize"><span></span></button>
		<section class="panel feedback-panel" aria-labelledby="feedback-title">
			<h2 id="feedback-title">Live feedback</h2>
			<div class="panel-body mt-4">
				{#each struggles as item}
					<article class="border-b py-4 first:pt-0 last:border-0 last:pb-0">
						<div class="flex justify-between gap-2 text-sm"><span class="font-medium">{item.id} <span class="ml-2 text-muted-foreground">Struggling: {item.topic}</span></span><span class="text-muted-foreground">{item.time}</span></div>
						<p class="mt-2 text-sm leading-6">{item.text}</p>
					</article>
				{/each}
				{#each feedback as item}
					<article class="border-b py-4 first:pt-0 last:border-0 last:pb-0">
						<div class="flex justify-between gap-2 text-sm"><span class="font-medium">{item.id} <span class="ml-2 text-muted-foreground">{item.rating}/5</span></span><span class="text-muted-foreground">{item.time}</span></div>
						<p class="mt-2 text-sm leading-6">{item.text}</p>
					</article>
				{/each}
			</div>
		</section>
		</div>
		{@render widthHandle("snapshot and feedback")}
		<section class="panel spending-panel" aria-labelledby="spending-title">
			<h2 id="spending-title">Session spending</h2>
			<div class="panel-body spending-content">
				<div class="chart-stat"><strong>{currency.format(totalSpent)}</strong><span>Spent this session</span></div>
				<div class="chart-space" bind:clientWidth={spendingWidth} bind:clientHeight={spendingHeight}><svg class="spending-chart" viewBox={`0 0 ${spendingWidth} ${spendingHeight}`} role="img" aria-label={`Cumulative spending: ${spending.map((point) => `${point.time}: ${currency.format(point.amount)}`).join(', ')}`}>
					<defs><linearGradient id="spending-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7d8da9" stop-opacity="0.2" /><stop offset="100%" stop-color="#7d8da9" stop-opacity="0" /></linearGradient></defs>
					{#each [0, 0.5, 1] as fraction}
						<line x1="44" x2={spendingWidth - 24} y1={spendingY(fraction * spendingCeiling)} y2={spendingY(fraction * spendingCeiling)} stroke="#ededed" />
						<text x="0" y={spendingY(fraction * spendingCeiling) + 4}>{currency.format(fraction * spendingCeiling)}</text>
					{/each}
					<polygon points={`44,${spendingY(0)} ${spendingPoints} ${spendingWidth - 24},${spendingY(0)}`} fill="url(#spending-fill)" />
					<polyline points={spendingPoints} fill="none" stroke="#7d8da9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
					{#each spending as point, i}<circle cx={spendingX(i)} cy={spendingY(point.amount)} r="3.5" fill="white" stroke="#7d8da9" stroke-width="2"><title>{point.time}: {currency.format(point.amount)}</title></circle>{#if i % 2 === 0}<text x={spendingX(i)} y={spendingHeight - 6} text-anchor="middle">{point.time}</text>{/if}{/each}
				</svg></div>
				<div class="budget-controls">
					<div class="flex items-center justify-between gap-4"><label for="spending-cap" class="text-sm">Spending cap ($)</label><input id="spending-cap" type="number" min="0" step="0.01" required bind:value={spendingCap} aria-invalid={!validCap} class="field cap-field" /></div>
					{#if validCap}
						<progress class="budget-progress" max="100" value={spendingPercent} aria-label="Spending cap used"></progress>
						<p class="text-sm text-muted-foreground" aria-live="polite">{totalSpent > spendingCap! ? `${currency.format(totalSpent - spendingCap!)} over cap` : `${currency.format(spendingCap! - totalSpent)} remaining`} of {currency.format(spendingCap!)}</p>
					{:else}<p class="mt-3 text-sm text-muted-foreground" role="alert">Enter a cap of $0 or more.</p>{/if}
				</div>
			</div>
		</section>
		{@render widthHandle("spending")}
		{#each students.filter((student) => student.messages.length > 0) as student (student.label)}
	<section class="panel chat-panel" aria-labelledby={`chat-${student.label}`}>
		<div class="flex items-center justify-between gap-3"><h2 id={`chat-${student.label}`}>Student {student.label}</h2></div>
		<p class="mt-1 text-sm text-muted-foreground">{student.messages.length} messages, {student.count} sessions attended</p>
		<div class="panel-body mt-5 flex flex-col gap-5">
			{#each student.messages as message}
				<Message.Root from={message.role === 'user' ? 'user' : 'assistant'}>
					<Message.Content>
						<span class="sr-only">{message.role === 'user' ? 'Student' : 'Assistant'}: </span>
						{#if message.role === 'assistant'}<Message.Response content={message.text} mode="static" />{:else}<p class="whitespace-pre-wrap wrap-break-words">{message.text}</p>{/if}
					</Message.Content>
				</Message.Root>
			{/each}
		</div>
	</section>
	{@render widthHandle(`student ${student.label} chat`)}
{/each}
	</div>

</main>

<Dialog.Root bind:open={qrExpanded}>
	<Dialog.Content class="rounded-[26px] sm:max-w-4xl">
		<Dialog.Header>
			<Dialog.Title class="text-2xl md:text-3xl">Join the session</Dialog.Title>
			<Dialog.Description class="text-base md:text-lg">Scan the QR code, or type the link below on a laptop.</Dialog.Description>
		</Dialog.Header>
		<img src={data.qr} alt="Expanded QR code for the student sign-in link" width="640" height="640" class="mx-auto aspect-square max-h-[55dvh] w-full object-contain" />
		<a href={data.sessionUrl} class="mb-4 break-all text-center font-mono text-2xl font-medium hover:underline md:text-4xl">{data.sessionUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={confirmEnd}>
	<Dialog.Content class="rounded-[26px]">
		<Dialog.Header><Dialog.Title>End this lesson?</Dialog.Title><Dialog.Description>Students will be asked for feedback and won't be able to chat any more.</Dialog.Description></Dialog.Header>
		<Dialog.Footer><Button class="gap-2 rounded-full px-3 font-normal" onclick={() => confirmEnd = false}>Cancel</Button><form method="POST" action="?/end" use:enhance={() => { confirmEnd = false; }}><Button type="submit" class="gap-2 rounded-full px-3 font-normal">End lesson</Button></form></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={confirmShutdown}>
	<Dialog.Content class="rounded-[26px]">
		<Dialog.Header><Dialog.Title>Shut down the assistant?</Dialog.Title><Dialog.Description>This stops the server. Nobody will be able to open the app until it is started again.</Dialog.Description></Dialog.Header>
		<Dialog.Footer><Button class="gap-2 rounded-full px-3 font-normal" onclick={() => confirmShutdown = false}>Cancel</Button><form method="POST" action="?/shutdown" use:enhance={() => { confirmShutdown = false; shutDown = true; return () => {}; }}><Button type="submit" class="gap-2 rounded-full px-3 font-normal">Shut down</Button></form></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.teacher-dashboard {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		overflow: hidden;
		background: #fff;
	}
	.lesson-actions { position: fixed; top: 8px; right: 20px; z-index: 30; display: flex; align-items: center; gap: 8px; }
	.dashboard-rail {
		position: relative;
		display: flex;
		flex: 1;
		min-height: 0;
		gap: 0;
		width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		padding: max(81px, calc((100dvh - 670px) / 2)) 24px;
		scroll-padding-inline: 24px;
		scrollbar-width: none;
		overscroll-behavior: contain;
	}
	.dashboard-rail::-webkit-scrollbar { display: none; }
	.panel { display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; scroll-snap-align: start; border: 1px solid var(--border); border-radius: 16px; padding: 20px; background: var(--background); }
	.card-column { display: grid; min-height: 0; min-width: 0; scroll-snap-align: start; }
	.card-resizer { display: flex; align-items: center; justify-content: center; width: 100%; padding: 0; border: 0; background: transparent; cursor: row-resize; touch-action: none; }
	.card-resizer span { width: 32px; height: 3px; border-radius: 2px; background: var(--border); }
	.card-resizer:hover span, .card-resizer:focus-visible span { background: var(--muted-foreground); }
	.card-resizer:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
	.dashboard-rail > .panel, .card-column { flex: 0 0 clamp(300px, 30vw, 390px); }
	.column-resizer { display: flex; align-items: center; justify-content: center; flex: 0 0 14px; align-self: stretch; padding: 0; border: 0; background: transparent; cursor: col-resize; touch-action: none; }
	.column-resizer span { width: 3px; height: 32px; border-radius: 2px; background: var(--border); }
	.column-resizer:hover span, .column-resizer:focus-visible span { background: var(--muted-foreground); }
	.column-resizer:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
	.spending-content { display: flex; flex-direction: column; gap: 24px; }
	.chart-space { position: relative; flex: 1; min-height: 0; width: 100%; }
	.chart-space > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	.budget-controls { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); }
	.cap-field { max-width: 112px; }
	.budget-progress { display: block; width: 100%; height: 6px; margin-block: 18px 10px; appearance: none; border: none; border-radius: 999px; overflow: hidden; background: #eee; }
	.budget-progress::-webkit-progress-bar { background: #eee; }
	.budget-progress::-webkit-progress-value { background: #7d8da9; border-radius: 999px; }
	.budget-progress::-moz-progress-bar { background: #7d8da9; border-radius: 999px; }
	.panel > h2, .panel > div:first-child:not(.join-content) { flex-shrink: 0; }
	.panel-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; padding-right: 4px; }
	.join-content { display: flex; flex: 1; justify-content: center; min-height: 0; padding-block: 4px; }
	.join-content img { width: 100%; height: 100%; min-height: 0; object-fit: contain; }
	.dashboard-rail:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
	.metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 24px; align-content: space-evenly; margin-top: 12px; }
	.metric-grid strong, .chart-stat strong { display: block; font-size: clamp(24px, 2.8vw, 36px); font-weight: 500; letter-spacing: -0.05em; line-height: 1.1; }
	.metric-grid span { display: block; margin-top: 8px; font-size: 14px; color: var(--muted-foreground); }
	.chart-stat small { font-size: 14px; font-weight: 400; color: var(--muted-foreground); letter-spacing: 0; }
	.chart-stat { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
	.chart-stat > span { font-size: 14px; color: var(--muted-foreground); }
	.attendance-space { margin-top: 8px; }
	svg text { fill: #777; font-size: 12px; font-family: inherit; }
	.ratings-content { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; margin-top: 12px; }
	.ratings-pie { width: 100%; height: 100%; min-height: 0; }
	.ratings-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; min-width: 0; font-size: 12px; }
	.ratings-legend li { display: flex; align-items: center; gap: 8px; padding-block: 4px; }
	.ratings-legend li > span:last-child { margin-left: auto; white-space: nowrap; }
	.rating-swatch { width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%; }

	h2 { font-size: 14px; font-weight: 500; letter-spacing: -0.01em; }
	.remove-resource { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 36px; padding: 0; border: 0; background: transparent; color: var(--muted-foreground); cursor: pointer; }
	.remove-resource:hover { color: var(--foreground); }
	.remove-resource:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
	.field { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 14px; background: var(--background); }
	.field:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
	@media (max-width: 900px) {
		.teacher-dashboard { padding-block: 116px; }
		.lesson-actions { top: 54px; right: 16px; }
	}
	@media (max-width: 600px) {
		.dashboard-rail { padding-inline: 12px; scroll-padding-inline: 12px; }
		.dashboard-rail > .panel, .card-column { flex-basis: calc(100vw - 40px); }
		.column-resizer { flex-basis: 12px; }
		.panel { padding: 14px; }
	}
</style>
