import os
import time
from typing import Dict, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

from app.logger import get_logger

load_dotenv()
logger = get_logger(__name__)


class LLMService:
    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.client = None
        
        if self.api_key and self.api_key != "your_deepseek_api_key":
            self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
            logger.info("LLM service initialized with DeepSeek API")
        else:
            logger.warning("DEEPSEEK_API_KEY not configured, using mock analysis")

    async def analyze_health_data(self, health_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Use DeepSeek LLM to analyze health data and provide a realistic situational report.
        """
        if not self.client:
            return self._mock_analysis(health_data)

        heart_rate = health_data.get('heart_rate', 70)
        systolic = health_data.get('systolic_bp', 120)
        diastolic = health_data.get('diastolic_bp', 80)
        steps = health_data.get('steps', 0)
        location = health_data.get('location', '未知')
        activity = health_data.get('activity', '未知')
        
        prompt = f"""
        你是一个专业的老年人健康监护AI助手。请根据以下实时监测数据进行分析：
        - 心率: {heart_rate} bpm
        - 血压: {systolic}/{diastolic} mmHg
        - 今日步数: {steps}
        - 当前位置: {location}
        - 活动状态: {activity}
        - 当前时间: {time.strftime('%H:%M')}

        请以监护人的视角，生成一段简洁、自然、拟人化的中文情况汇报（约50-100字）。
        如果数据正常，描述老人在该位置从事该活动的安稳状态；
        如果数据异常（如心率过快或偏离位置），请用专业但富有同理心的口吻发出预警并给出建议。
        
        仅输出汇报文本和风险等级（低/中/高），格式如下：
        报告: [汇报文本]
        风险: [风险等级]
        """

        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一个专业的老年人健康监护AI助手。"},
                    {"role": "user", "content": prompt}
                ],
                stream=False,
                timeout=30.0  # 30 second timeout
            )
            content = response.choices[0].message.content
            
            # Simple parsing
            report = "解析失败"
            risk = "低"
            for line in content.split('\n'):
                if line.startswith("报告:"):
                    report = line.replace("报告:", "").strip()
                elif line.startswith("风险:"):
                    risk = line.replace("风险:", "").strip()
            
            logger.debug(f"LLM analysis completed: risk={risk}")
            return {
                "analysis_report": report,
                "risk_assessment": risk,
                "suggestion": "建议立即联系老人确认情况。" if risk == "高" else "建议保持当前作息。"
            }
        except Exception as e:
            logger.error(f"LLM API Error: {e}")
            return self._mock_analysis(health_data)

    def _mock_analysis(self, health_data: Dict[str, Any]) -> Dict[str, Any]:
        heart_rate = health_data.get('heart_rate', 70)
        risk_level = "低"
        if heart_rate > 100:
            analysis_text = "检测到心率异常升高（>100bpm）。建议关注是否为焦虑或突发身体不适。"
            risk_level = "高"
        else:
            analysis_text = "目前各项生命体征平稳，老人状态安详。"
            
        return {
            "analysis_report": analysis_text,
            "risk_assessment": risk_level,
            "suggestion": "请保持关注。"
        }

    async def generate_weekly_report(self, user_id: int) -> str:
        """
        Generate a detailed weekly health report using DeepSeek.
        """
        if not self.client:
            return "AI服务暂不可用，无法生成详细周报。"

        prompt = f"请为用户(ID: {user_id})生成一份专业的老年人健康周报。包含本周健康趋势、异常点总结和下周运动建议。使用Markdown格式。"
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一个资深的健康管理专家。"},
                    {"role": "user", "content": prompt}
                ],
                timeout=60.0  # 60 second timeout for longer report
            )
            logger.info(f"Weekly report generated for user {user_id}")
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Failed to generate weekly report: {e}")
            return f"生成周报时出错: {e}"

    async def chat_with_context(self, message: str, context: Dict[str, Any]) -> str:
        """
        基于上下文的 AI 对话
        """
        elder_name = context.get("elder_name", "老人")
        
        # 构建系统提示
        system_prompt = f"""你是一个专业的老年人健康监护AI助手。
你正在帮助监护人了解{elder_name}的健康状况。
请用简洁、亲切、专业的语言回答问题。
回答控制在100字以内，重点突出。"""
        
        # 构建上下文信息
        context_info = f"当前时间: {context.get('current_time', '未知')}\n"
        
        if "latest" in context:
            latest = context["latest"]
            context_info += f"""
{elder_name}最新数据 ({latest.get('time', '未知')}):
- 心率: {latest.get('heart_rate', '--')} bpm
- 血压: {latest.get('blood_pressure', '--')} mmHg
- 今日步数: {latest.get('steps', '--')}
"""
        
        if "week_stats" in context:
            stats = context["week_stats"]
            context_info += f"""
近一周统计:
- 平均心率: {stats.get('avg_heart_rate', '--')} bpm
- 心率范围: {stats.get('min_heart_rate', '--')}-{stats.get('max_heart_rate', '--')} bpm
- 总步数: {stats.get('total_steps', '--')}
- 记录数: {stats.get('record_count', '--')}条
"""
        
        if "recent_alerts" in context:
            alerts = context["recent_alerts"]
            context_info += "\n最近告警:\n"
            for a in alerts:
                context_info += f"- [{a['severity']}] {a['desc']}\n"
        
        if not self.client:
            # Mock 回复
            return self._mock_chat_reply(message, context)
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"背景信息:\n{context_info}\n\n用户问题: {message}"}
                ],
                timeout=30.0
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Chat API Error: {e}")
            return self._mock_chat_reply(message, context)

    def _mock_chat_reply(self, message: str, context: Dict[str, Any]) -> str:
        """无API时的模拟回复"""
        elder_name = context.get("elder_name", "老人")
        
        if "心率" in message or "血压" in message:
            if "latest" in context:
                latest = context["latest"]
                hr = latest.get("heart_rate", 72)
                bp = latest.get("blood_pressure", "120/80")
                status = "正常" if 60 <= hr <= 100 else "需要关注"
                return f"{elder_name}当前心率 {hr} bpm，血压 {bp} mmHg，整体状态{status}。"
            return f"暂无{elder_name}的实时健康数据。"
        
        if "运动" in message or "步数" in message:
            if "week_stats" in context:
                total_steps = context["week_stats"].get("total_steps", 0)
                avg_steps = total_steps // 7 if total_steps else 0
                assessment = "运动量良好" if avg_steps >= 5000 else "建议增加运动"
                return f"{elder_name}本周总步数 {total_steps}，日均 {avg_steps} 步，{assessment}。"
            return f"暂无{elder_name}的运动数据。"
        
        if "异常" in message or "风险" in message or "关注" in message:
            if "recent_alerts" in context and context["recent_alerts"]:
                alert = context["recent_alerts"][0]
                return f"最近检测到: {alert['desc']}。建议留意{elder_name}的身体状况。"
            return f"{elder_name}最近没有明显异常，各项指标稳定。"
        
        # 默认回复
        if "latest" in context:
            return f"{elder_name}目前状态良好，心率和血压均在正常范围内。请问您想了解哪方面的信息？"
        return f"您好！我可以帮您了解{elder_name}的健康状况。试着问我关于心率、血压或运动情况的问题吧！"

    async def generate_detailed_weekly_report(self, elder_name: str, stats: Dict[str, Any]) -> str:
        """
        基于真实数据生成详细周报
        """
        # 构建数据摘要
        data_summary = f"""
被监护人: {elder_name}
统计周期: 过去7天
数据记录: {stats['total_records']}条 (有数据{stats['days_with_data']}天)

心率统计:
- 平均: {stats['avg_heart_rate']} bpm
- 最高: {stats['max_heart_rate']} bpm  
- 最低: {stats['min_heart_rate']} bpm
- 过高次数(>100): {stats['high_hr_count']}次
- 过低次数(<50): {stats['low_hr_count']}次

血压统计:
- 平均: {stats['avg_systolic']}/{stats['avg_diastolic']} mmHg
- 过高次数(>140): {stats['high_bp_count']}次

运动统计:
- 总步数: {stats['total_steps']}
- 日均: {stats['avg_daily_steps']}步

告警统计:
- 总告警: {stats['alert_count']}次
- 高风险: {stats['high_alerts']}次
"""
        
        if not self.client:
            # Mock 报告
            return self._generate_mock_report(elder_name, stats)
        
        prompt = f"""
请根据以下健康数据，为{elder_name}生成一份专业的周报。

{data_summary}

请生成包含以下内容的报告（不要使用Markdown格式，用纯文本）:
1. 总体评估（一句话总结）
2. 心率分析（2-3句）
3. 血压分析（2-3句）
4. 运动评估（2-3句）
5. 健康建议（2-3条具体建议）

语言要温暖、专业，适合家属阅读。总字数控制在300字内。
"""
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一位专业的老年人健康管理专家。"},
                    {"role": "user", "content": prompt}
                ],
                timeout=60.0
            )
            logger.info(f"Detailed weekly report generated for {elder_name}")
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Failed to generate detailed report: {e}")
            return self._generate_mock_report(elder_name, stats)

    def _generate_mock_report(self, elder_name: str, stats: Dict[str, Any]) -> str:
        """生成模拟报告"""
        # 评估状态
        hr_status = "正常" if stats['high_hr_count'] < 5 else "需关注"
        bp_status = "正常" if stats['high_bp_count'] < 3 else "偏高"
        exercise_status = "良好" if stats['avg_daily_steps'] >= 5000 else "建议增加"
        
        overall = "表现良好" if stats['high_alerts'] == 0 else "需要关注"
        
        return f"""【{elder_name}健康周报】

总体评估: 本周健康状况{overall}，共采集{stats['total_records']}条健康记录。

心率分析: 平均心率{stats['avg_heart_rate']}bpm，在{stats['min_heart_rate']}-{stats['max_heart_rate']}bpm范围内波动，整体{hr_status}。{'本周有'+str(stats['high_hr_count'])+'次心率过快记录，建议留意。' if stats['high_hr_count'] > 0 else ''}

血压分析: 平均血压{stats['avg_systolic']}/{stats['avg_diastolic']}mmHg，血压水平{bp_status}。{'有'+str(stats['high_bp_count'])+'次收缩压超过140mmHg，建议清淡饮食。' if stats['high_bp_count'] > 0 else ''}

运动评估: 本周总步数{stats['total_steps']}步，日均{stats['avg_daily_steps']}步，运动量{exercise_status}。

健康建议:
• 保持规律作息，建议晚上10点前入睡
• {'适当增加户外活动，建议每日步数达到5000步以上' if stats['avg_daily_steps'] < 5000 else '继续保持良好的运动习惯'}
• {'注意监测血压变化，减少盐分摄入' if stats['high_bp_count'] > 0 else '饮食均衡，多吃蔬果'}"""

    async def analyze_personal_baseline(self, elder_name: str, records_summary: dict) -> dict:
        """
        AI 分析历史数据，生成个性化健康画像
        
        Args:
            elder_name: 老人姓名
            records_summary: 历史数据统计摘要
        
        Returns:
            个性化基线数据字典
        """
        prompt = f"""
你是专业的老年健康数据分析师。请根据{elder_name}过去{records_summary.get('days', 30)}天的健康数据，分析并生成个性化健康基线画像。

【数据统计】
- 总记录数: {records_summary.get('total_records', 0)}条
- 有效天数: {records_summary.get('days_with_data', 0)}天

【心率数据】
- 平均心率: {records_summary.get('hr_mean', 72)} bpm
- 最低心率: {records_summary.get('hr_min', 55)} bpm
- 最高心率: {records_summary.get('hr_max', 110)} bpm
- 心率标准差: {records_summary.get('hr_std', 10)}

【血压数据】
- 平均收缩压: {records_summary.get('systolic_mean', 120)} mmHg
- 平均舒张压: {records_summary.get('diastolic_mean', 80)} mmHg
- 收缩压范围: {records_summary.get('systolic_min', 100)}-{records_summary.get('systolic_max', 140)} mmHg

【活动数据】
- 日均步数: {records_summary.get('steps_mean', 5000)}
- 步数标准差: {records_summary.get('steps_std', 1500)}
- 最活跃时段: {records_summary.get('active_hours', '上午')}

【位置数据】
- 在家比例: {records_summary.get('home_ratio', 0.7)*100:.0f}%
- 常去位置: {records_summary.get('frequent_locations', ['家', '公园'])}

请基于以上数据，输出JSON格式的个性化基线（不要输出其他内容）：
{{
    "learned_hr_low": <根据数据分析的合理心率下限>,
    "learned_hr_high": <根据数据分析的合理心率上限>,
    "resting_hr": <推断的静息心率>,
    "exercise_hr_max": <推断的运动最大心率>,
    "wake_time": "<推断的起床时间 HH:MM>",
    "sleep_time": "<推断的入睡时间 HH:MM>",
    "outdoor_preference": "<morning/afternoon/evening>",
    "health_summary": "<一句话描述该老人的健康特点，30字内>",
    "risk_factors": ["<潜在风险因素1>", "<风险因素2>"],
    "personalized_advice": ["<针对性建议1>", "<建议2>", "<建议3>"],
    "confidence_score": <0-1之间的置信度，数据越充分越高>
}}
"""
        
        if not self.client:
            return self._mock_baseline_analysis(records_summary)
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是专业的老年健康数据分析师，擅长从历史数据中提取个性化健康基线。只输出JSON，不要输出其他内容。"},
                    {"role": "user", "content": prompt}
                ],
                timeout=60.0
            )
            content = response.choices[0].message.content
            
            # 解析JSON
            import json
            # 清理可能的markdown标记
            content = content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            result = json.loads(content)
            logger.info(f"AI baseline analysis completed for {elder_name}")
            return result
            
        except Exception as e:
            logger.error(f"AI baseline analysis failed: {e}")
            return self._mock_baseline_analysis(records_summary)
    
    def _mock_baseline_analysis(self, records_summary: dict) -> dict:
        """无API时的模拟基线分析"""
        hr_mean = records_summary.get('hr_mean', 72)
        hr_std = records_summary.get('hr_std', 10)
        
        return {
            "learned_hr_low": max(50, hr_mean - 2 * hr_std),
            "learned_hr_high": min(120, hr_mean + 2 * hr_std),
            "resting_hr": hr_mean - 5,
            "exercise_hr_max": hr_mean + 30,
            "wake_time": "06:30",
            "sleep_time": "21:30",
            "outdoor_preference": "morning",
            "health_summary": "整体健康状况稳定，生活规律",
            "risk_factors": [],
            "personalized_advice": ["保持规律作息", "适当户外活动"],
            "confidence_score": 0.5
        }

    async def multi_dimension_analysis(
        self, 
        current_data: dict, 
        baseline: dict, 
        context: dict
    ) -> dict:
        """
        AI 多维度关联分析
        结合当前数据、个人基线、上下文进行综合判断
        
        Args:
            current_data: 当前实时数据
            baseline: 个人基线数据
            context: 上下文信息（趋势、时间等）
        
        Returns:
            多维度分析结果
        """
        elder_name = context.get('elder_name', '老人')
        current_hour = context.get('current_hour', 12)
        
        # 计算与基线的偏离
        hr = current_data.get('heart_rate', 72)
        hr_baseline_low = baseline.get('learned_hr_low', 60)
        hr_baseline_high = baseline.get('learned_hr_high', 100)
        hr_deviation = 0
        if hr < hr_baseline_low:
            hr_deviation = (hr_baseline_low - hr) / hr_baseline_low * 100
        elif hr > hr_baseline_high:
            hr_deviation = (hr - hr_baseline_high) / hr_baseline_high * 100
        
        prompt = f"""
你是专业的老年健康监护AI。请综合分析以下多维度数据，进行关联推理。

【当前实时数据】
- 心率: {current_data.get('heart_rate', 72)} bpm
- 血压: {current_data.get('systolic_bp', 120)}/{current_data.get('diastolic_bp', 80)} mmHg
- 今日步数: {current_data.get('steps', 0)}
- 当前位置: {current_data.get('location', '未知')}
- 当前时间: {current_hour}:00

【{elder_name}的个人基线】(AI学习得出)
- 正常心率范围: {hr_baseline_low:.0f}-{hr_baseline_high:.0f} bpm
- 静息心率: {baseline.get('resting_hr', 65):.0f} bpm
- 日均步数: {baseline.get('daily_steps_mean', 5000)}
- 通常起床: {baseline.get('wake_time', '06:30')} / 入睡: {baseline.get('sleep_time', '21:30')}
- 外出偏好: {baseline.get('outdoor_preference', 'morning')}
- 在家比例: {baseline.get('home_stay_ratio', 0.7)*100:.0f}%

【偏离分析】
- 心率偏离基线: {hr_deviation:.1f}%
- 位置状态: {context.get('location_status', '正常')}
- 近1小时心率趋势: {context.get('hr_trend', '平稳')}

请进行多维度关联分析，考虑：
1. 当前状态与个人基线的对比
2. 不同维度之间的关联（如心率+位置+时间）
3. 可能的原因推断

输出JSON格式（不要输出其他内容）：
{{
    "risk_level": "<低/中/高/紧急>",
    "anomaly_type": "<正常/单一异常/复合异常>",
    "cross_analysis": "<跨维度关联分析结论，50字内>",
    "possible_causes": ["<可能原因1>", "<可能原因2>"],
    "recommended_action": "<建议采取的行动>",
    "confidence": <0-1之间>,
    "explanation": "<给监护人看的通俗解释，80字内，要提及与平时的对比>"
}}
"""
        
        if not self.client:
            return self._mock_multi_dimension_analysis(current_data, baseline, context)
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是专业的老年健康监护AI，擅长多维度数据关联分析。只输出JSON，不要输出其他内容。"},
                    {"role": "user", "content": prompt}
                ],
                timeout=30.0
            )
            content = response.choices[0].message.content
            
            import json
            content = content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            result = json.loads(content)
            logger.debug(f"Multi-dimension analysis: risk={result.get('risk_level')}")
            return result
            
        except Exception as e:
            logger.error(f"Multi-dimension analysis failed: {e}")
            return self._mock_multi_dimension_analysis(current_data, baseline, context)
    
    def _mock_multi_dimension_analysis(self, current_data: dict, baseline: dict, context: dict) -> dict:
        """无API时的模拟多维度分析"""
        hr = current_data.get('heart_rate', 72)
        hr_high = baseline.get('learned_hr_high', 100)
        hr_low = baseline.get('learned_hr_low', 60)
        location = current_data.get('location', '家')
        
        # 简单规则判断
        risk_level = "低"
        anomaly_type = "正常"
        explanation = f"目前各项指标在个人正常范围内，状态良好。"
        
        if hr > hr_high:
            risk_level = "中"
            anomaly_type = "单一异常"
            deviation = (hr - hr_high) / hr_high * 100
            explanation = f"心率{hr}bpm，比平时上限({hr_high:.0f}bpm)高出{deviation:.0f}%。"
            if location == "未知区域":
                risk_level = "高"
                anomaly_type = "复合异常"
                explanation += "且位置偏离常规区域，建议立即确认安全。"
        elif hr < hr_low:
            risk_level = "中"
            anomaly_type = "单一异常"
            explanation = f"心率{hr}bpm，低于平时下限({hr_low:.0f}bpm)，请关注。"
        
        return {
            "risk_level": risk_level,
            "anomaly_type": anomaly_type,
            "cross_analysis": "基于规则引擎的基础分析",
            "possible_causes": ["需要更多数据确认"],
            "recommended_action": "保持关注" if risk_level == "低" else "建议电话确认",
            "confidence": 0.6,
            "explanation": explanation
        }

    async def generate_contextual_alert(
        self, 
        anomaly_data: dict, 
        baseline: dict,
        elder_name: str = "老人"
    ) -> str:
        """
        生成对比个人基线的智能告警文案
        
        Args:
            anomaly_data: 异常数据
            baseline: 个人基线
            elder_name: 老人姓名
        
        Returns:
            智能告警文案
        """
        hr = anomaly_data.get('heart_rate', 72)
        hr_baseline = f"{baseline.get('learned_hr_low', 60):.0f}-{baseline.get('learned_hr_high', 100):.0f}"
        location = anomaly_data.get('location', '未知')
        typical_location = baseline.get('typical_location_at_hour', '家')
        current_hour = anomaly_data.get('hour', 12)
        
        prompt = f"""
检测到{elder_name}健康数据异常，请生成一段简洁的告警文案。

【异常数据】
- 当前心率: {hr} bpm
- 个人正常范围: {hr_baseline} bpm
- 当前位置: {location}
- 此时段通常位置: {typical_location}
- 当前时间: {current_hour}:00
- 异常类型: {anomaly_data.get('anomaly_type', '未知')}

请生成一段50字内的告警文案，要求：
1. 明确说明与个人平时习惯的对比
2. 简要分析可能原因
3. 给出具体建议

直接输出告警文案，不要输出其他内容。
"""
        
        if not self.client:
            # 模拟告警
            deviation = abs(hr - baseline.get('learned_hr_mean', 72))
            return f"{elder_name}心率{hr}bpm，偏离平时{deviation:.0f}bpm。当前在{location}，建议电话确认情况。"
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是老年健康监护告警系统，生成简洁、专业、温暖的告警文案。"},
                    {"role": "user", "content": prompt}
                ],
                timeout=15.0
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Generate alert failed: {e}")
            return f"{elder_name}健康数据异常（心率{hr}bpm），建议关注。"


llm_service = LLMService()
