#!/usr/bin/env node
/**
 * Safety net for the Open Plugin Market listing (https://dshopen.org, index
 * source: https://github.com/polang233/dsh-plugin-index).
 *
 * The index follows the npm `latest` tag and rebuilds every six hours, so a
 * release needs nothing pushed to the index repository. What can go wrong is the
 * other direction: a per-package check that keeps failing leaves the listing
 * frozen at an old version, and an entry that disappears means it was withdrawn.
 * This script looks for exactly that and is what the `index-sync` workflow runs.
 *
 *   node scripts/index-sync.mjs                         report only
 *   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node …   also open/close the issue
 *
 * A version released less than GRACE_HOURS ago is not reported: the next index
 * build has simply not run yet. An open `[plugin-add]` issue on the index
 * repository means the listing is still being reviewed, which is not drift.
 */

const NAME = 'dsh-message-rewind';
const INDEX_REPO = 'polang233/dsh-plugin-index';
const INDEX_URL = 'https://dshopen.org/index.json';
const STATUS_URL = 'https://dshopen.org/status.json';
const GRACE_HOURS = 24;
const TITLE = '[index-sync] 开放插件市场的收录版本落后于 npm latest';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;

async function readJson(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': `${NAME}-index-sync` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}：${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/** One GitHub REST call; the token is optional so public reads work locally. */
async function github(target, method, path, body) {
  const response = await fetch(`https://api.github.com/repos/${target}${path}`, {
    method,
    headers: {
      'user-agent': `${NAME}-index-sync`,
      accept: 'application/vnd.github+json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub ${method} /repos/${target}${path}：HTTP ${response.status}`);
  return response.json();
}

/** The drift issue this repository keeps, or null when there is none open. */
async function openDriftIssue() {
  if (!token || !repo) return null;
  const issues = await github(repo, 'GET', '/issues?state=open&per_page=100');
  return issues.find((issue) => issue.title === TITLE && !issue.pull_request) ?? null;
}

async function closeDriftIssue(comment) {
  const issue = await openDriftIssue();
  if (!issue) return;
  await github(repo, 'POST', `/issues/${issue.number}/comments`, { body: comment });
  await github(repo, 'PATCH', `/issues/${issue.number}`, { state: 'closed' });
  console.log(`closed #${issue.number}`);
}

async function reportDrift(report) {
  if (!token || !repo) {
    console.log('GITHUB_TOKEN / GITHUB_REPOSITORY 未设置：只报告，不改 issue。\n');
    console.log(report);
    return;
  }
  const issue = await openDriftIssue();
  if (issue) {
    await github(repo, 'PATCH', `/issues/${issue.number}`, { body: report });
    console.log(`updated #${issue.number}`);
  } else {
    const created = await github(repo, 'POST', '/issues', { title: TITLE, body: report });
    console.log(`opened #${created.number}`);
  }
}

/** An open `[plugin-add]` request that mentions us: the listing is still under review. */
async function pendingSubmission() {
  const issues = await github(INDEX_REPO, 'GET', '/issues?state=open&per_page=100');
  return issues.find((issue) => {
    if (issue.pull_request) return false;
    return `${issue.title}\n${issue.body ?? ''}`.includes(NAME);
  }) ?? null;
}

const packument = await readJson(`https://registry.npmjs.org/${NAME}`);
const latest = packument['dist-tags'].latest;
const publishedAt = Date.parse(packument.time[latest]);
const ageHours = (Date.now() - publishedAt) / 3600_000;

const index = await readJson(INDEX_URL);
const entry = index.plugins?.find((plugin) => plugin.name === NAME);
const listed = entry?.versions?.[0]?.version ?? null;

if (listed === latest) {
  console.log(`in sync：市场里是 ${NAME}@${listed}`);
  await closeDriftIssue(`开放插件市场已更新到 \`${latest}\`，这个 issue 自动关闭。`);
} else if (ageHours < GRACE_HOURS) {
  console.log(`waiting：npm latest 是 ${latest}（${ageHours.toFixed(1)} 小时前发布），市场里是 ${listed ?? '未收录'}`);
} else {
  const pending = await pendingSubmission();
  if (pending) {
    console.log(`审核中：市场里是 ${listed ?? '未收录'}，npm latest 是 ${latest}，收录申请 #${pending.number} 还开着`);
    process.exit(0);
  }

  const status = await readJson(STATUS_URL);
  const failure = status.failures?.find((item) => item.name === NAME);
  const published = `${new Date(publishedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const report = [
    `npm 上的 \`latest\` 是 \`${latest}\`（${published} 发布，已 ${Math.floor(ageHours)} 小时），` +
      `开放插件市场索引里${listed ? `还是 \`${listed}\`` : `还没有 \`${NAME}\``}。`,
    '',
    '索引每 6 小时从 npm `latest` 重建一次，这种情况通常是收录被移除，或者逐包检查一直失败。',
    failure
      ? `\n当前失败原因（[status.json](https://dshopen.org/status.json)）：\n\n> ${failure.error}`
      : '\n[status.json](https://dshopen.org/status.json) 里目前没有这个包的失败记录。',
    '',
    '处理方式：',
    '',
    `- 条目被移除 → 在 [${INDEX_REPO}](https://github.com/${INDEX_REPO}/issues) 的收录 issue 里回复维护者；`,
    '- 检查失败 → 按原因修上游（补丁文件、client 入口、许可证、`repository` 字段等），发一个新版本，等下一轮构建。',
    '',
    '同步后本 workflow 会自动关闭这个 issue。',
  ].join('\n');

  console.log(`drift：npm latest 是 ${latest}，市场里是 ${listed ?? '未收录'}（${Math.floor(ageHours)} 小时）`);
  await reportDrift(report);
  process.exit(1);
}
