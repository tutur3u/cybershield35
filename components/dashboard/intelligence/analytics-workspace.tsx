"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { BarList } from "@/components/dashboard/charts/bar-list";
import {
	ChartEmptyState,
	ChartFrame,
} from "@/components/dashboard/charts/chart-frame";
import { DonutChart } from "@/components/dashboard/charts/donut-chart";
import { TrendChart } from "@/components/dashboard/charts/trend-chart";
import type { IntelligenceFilters } from "@/components/dashboard/types";
import { intelligenceAnalyticsQueryOptions } from "@/lib/dashboard/client-queries";

const RISK_COLORS = {
	high: "var(--chart-risk-high)",
	low: "var(--chart-risk-low)",
	medium: "var(--chart-risk-medium)",
};

const RISK_SERIES = [
	{ color: RISK_COLORS.high, key: "high", label: "Rủi ro cao" },
	{ color: RISK_COLORS.medium, key: "medium", label: "Rủi ro trung bình" },
	{ color: RISK_COLORS.low, key: "low", label: "Rủi ro thấp" },
];

const CATEGORY_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function IntelligenceAnalyticsWorkspace({
	filters,
}: {
	filters: IntelligenceFilters;
}) {
	const analyticsQuery = useQuery(intelligenceAnalyticsQueryOptions(filters));
	const analytics = analyticsQuery.data;

	if (analyticsQuery.isPending) {
		return (
			<div className="grid min-h-64 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
				<LoaderCircle className="animate-spin text-[var(--accent)]" />
			</div>
		);
	}
	if (analyticsQuery.isError || !analytics) {
		return (
			<div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] font-bold text-[var(--danger-strong)]">
				{analyticsQuery.error?.message ?? "Không thể tải số liệu phân tích."}
			</div>
		);
	}

	const totalEvidence =
		analytics.riskByLevel.high +
		analytics.riskByLevel.medium +
		analytics.riskByLevel.low;
	const totalSentiment =
		analytics.sentiment.positive +
		analytics.sentiment.neutral +
		analytics.sentiment.negative;

	return (
		<div className="grid min-w-0 gap-4 xl:grid-cols-2">
			<ChartFrame
				description="Tỷ trọng nội dung theo mức cần ưu tiên xử lý."
				series={RISK_SERIES.map(({ color, label }) => ({ color, label }))}
				table={{
					headers: ["Mức rủi ro", "Số bài"],
					rows: [
						["Rủi ro cao", analytics.riskByLevel.high],
						["Rủi ro trung bình", analytics.riskByLevel.medium],
						["Rủi ro thấp", analytics.riskByLevel.low],
					],
				}}
				title="Cơ cấu rủi ro"
			>
				{totalEvidence ? (
					<DonutChart
						centerLabel="bài đã chấm"
						slices={[
							{
								color: RISK_COLORS.high,
								label: "Rủi ro cao",
								value: analytics.riskByLevel.high,
							},
							{
								color: RISK_COLORS.medium,
								label: "Rủi ro trung bình",
								value: analytics.riskByLevel.medium,
							},
							{
								color: RISK_COLORS.low,
								label: "Rủi ro thấp",
								value: analytics.riskByLevel.low,
							},
						]}
					/>
				) : (
					<ChartEmptyState message="Chưa có nội dung nào được chấm rủi ro trong khoảng thời gian này." />
				)}
			</ChartFrame>

			<ChartFrame
				description="Vì sao nội dung bị đánh giá là rủi ro — theo dấu hiệu quan sát được."
				table={{
					headers: ["Nhóm dấu hiệu", "Số bài"],
					rows: analytics.riskCategories.map((item) => [item.label, item.count]),
				}}
				title="Nguyên nhân rủi ro"
			>
				{analytics.riskCategories.length ? (
					<BarList
						rows={analytics.riskCategories.map((item, index) => ({
							label: item.label,
							segments: [
								{
									color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]!,
									label: item.label,
									value: item.count,
								},
							],
						}))}
					/>
				) : (
					<ChartEmptyState message="Chưa đủ dữ liệu phân loại. Chạy lại chấm rủi ro để có phân tích này." />
				)}
			</ChartFrame>

			<ChartFrame
				description="Diễn biến số bài theo từng mức rủi ro."
				series={RISK_SERIES.map(({ color, label }) => ({ color, label }))}
				table={{
					headers: ["Ngày", "Cao", "Trung bình", "Thấp"],
					rows: analytics.riskTrend.map((point) => [
						point.day,
						point.high,
						point.medium,
						point.low,
					]),
				}}
				title="Xu hướng rủi ro theo ngày"
			>
				{analytics.riskTrend.length > 1 ? (
					<TrendChart points={analytics.riskTrend} series={RISK_SERIES} />
				) : (
					<ChartEmptyState message="Cần ít nhất hai ngày dữ liệu để vẽ xu hướng." />
				)}
			</ChartFrame>

			<ChartFrame
				description="Chủ đề đang tập trung nhiều nội dung rủi ro nhất."
				series={RISK_SERIES.map(({ color, label }) => ({ color, label }))}
				table={{
					headers: ["Chủ đề", "Tổng", "Cao", "Trung bình", "Thấp"],
					rows: analytics.topics.map((topic) => [
						topic.name,
						topic.total,
						topic.high,
						topic.medium,
						topic.low,
					]),
				}}
				title="Phân tích theo chủ đề"
			>
				{analytics.topics.length ? (
					<BarList
						rows={analytics.topics.map((topic) => ({
							href: `/topics/${topic.slug}`,
							label: topic.name,
							meta: topic.high ? `${topic.high} rủi ro cao` : undefined,
							segments: [
								{ color: RISK_COLORS.high, label: "Rủi ro cao", value: topic.high },
								{
									color: RISK_COLORS.medium,
									label: "Rủi ro trung bình",
									value: topic.medium,
								},
								{ color: RISK_COLORS.low, label: "Rủi ro thấp", value: topic.low },
							],
						}))}
					/>
				) : (
					<ChartEmptyState message="Chưa có chủ đề nào được gắn nội dung." />
				)}
			</ChartFrame>

			<ChartFrame
				description="Nguồn đóng góp nhiều nội dung nhất và tỷ lệ rủi ro cao đi kèm."
				table={{
					headers: ["Nguồn", "Tổng bài", "Rủi ro cao"],
					rows: analytics.sources.map((source) => [
						source.label,
						source.total,
						source.highRiskCount,
					]),
				}}
				title="Đóng góp theo nguồn"
			>
				{analytics.sources.length ? (
					<BarList
						rows={analytics.sources.map((source) => ({
							href: `/evidence?facebookPage=${encodeURIComponent(source.label)}`,
							label: source.label,
							meta: source.highRiskCount
								? `${source.highRiskCount} rủi ro cao`
								: undefined,
							segments: [
								{
									color: RISK_COLORS.high,
									label: "Rủi ro cao",
									value: source.highRiskCount,
								},
								{
									color: "var(--chart-1)",
									label: "Còn lại",
									value: Math.max(0, source.total - source.highRiskCount),
								},
							],
						}))}
					/>
				) : (
					<ChartEmptyState message="Chưa có nguồn nào ghi nhận nội dung." />
				)}
			</ChartFrame>

			<ChartFrame
				description="Sắc thái chung của nội dung đã thu thập."
				table={{
					headers: ["Sắc thái", "Số bài"],
					rows: [
						["Tích cực", analytics.sentiment.positive],
						["Trung tính", analytics.sentiment.neutral],
						["Tiêu cực", analytics.sentiment.negative],
					],
				}}
				title="Sắc thái nội dung"
			>
				{totalSentiment ? (
					<DonutChart
						centerLabel="bài đã phân tích"
						slices={[
							{
								color: "var(--chart-5)",
								label: "Tích cực",
								value: analytics.sentiment.positive,
							},
							{
								color: "var(--chart-1)",
								label: "Trung tính",
								value: analytics.sentiment.neutral,
							},
							{
								color: "var(--chart-4)",
								label: "Tiêu cực",
								value: analytics.sentiment.negative,
							},
						]}
					/>
				) : (
					<ChartEmptyState message="Chưa có dữ liệu sắc thái." />
				)}
			</ChartFrame>
		</div>
	);
}
